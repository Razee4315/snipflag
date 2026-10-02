use base64::{engine::general_purpose::STANDARD, Engine};
use image::{codecs::png::{CompressionType, FilterType, PngEncoder}, DynamicImage, ExtendedColorType, ImageEncoder, ImageFormat, ImageReader, RgbaImage};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Map, Value};
use std::{collections::HashSet, io::Cursor, path::{Path, PathBuf}, sync::{atomic::{AtomicBool, Ordering}, Mutex}};
use tauri::{AppHandle, Manager, State, WebviewWindow};
use uuid::Uuid;

pub const MAX_IMAGES: usize = 10;
pub const MAX_IMAGE_BYTES: usize = 20 * 1024 * 1024;
pub const MAX_SESSION_BYTES: usize = 100 * 1024 * 1024;
pub const MAX_PIXELS: u64 = 40_000_000;
const MAX_ANNOTATIONS: usize = 2000;
const MAX_TEXT: usize = 100_000;
const MAX_PREVIEW: usize = 300_000;

pub struct Storage {
    pub root: PathBuf, pub db: Mutex<Connection>, mutations: Mutex<()>, pub cleanup_error: Mutex<Option<String>>,
    /// A save failed part-way and may have left image files without a draft row; the next save looks for them.
    rescan: AtomicBool,
}

pub fn main_only(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "main" { return Err("This action is restricted to the editor.".into()); }
    Ok(())
}
pub fn id(value: &str) -> Result<String, String> { Uuid::parse_str(value).map(|v| v.to_string()).map_err(|_| "Invalid identifier.".into()) }
pub fn now() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64 }

/// Decodes untrusted image bytes with allocation and dimension limits.
pub fn decode_image(bytes: &[u8]) -> Result<DynamicImage, String> {
    if bytes.len() > MAX_IMAGE_BYTES { return Err("Image exceeds the 20 MB limit.".into()); }
    let mut reader = ImageReader::new(Cursor::new(bytes)).with_guessed_format().map_err(|_| "Invalid image.")?;
    if !matches!(reader.format(), Some(ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP)) { return Err("Use a PNG, JPEG, or WebP image.".into()); }
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(20_000); limits.max_image_height = Some(20_000); limits.max_alloc = Some(400_000_000);
    reader.limits(limits);
    let image = reader.decode().map_err(|_| "Image could not be decoded within memory limits.")?;
    if image.width() as u64 * image.height() as u64 > MAX_PIXELS { return Err("Image exceeds 40 megapixels.".into()); }
    Ok(image)
}
/// Validates a PNG data URL from the editor and returns its encoded bytes plus dimensions. The size comes from the
/// PNG header: these images were just encoded by the editor's canvas, so their pixels are not decoded again here.
/// Files of unknown origin go through `decode_image`.
pub fn decode_png(value: &str) -> Result<(Vec<u8>, u32, u32), String> {
    let raw = value.strip_prefix("data:image/png;base64,").ok_or("Expected a PNG image.")?;
    if raw.len() > MAX_IMAGE_BYTES / 3 * 4 + 8 { return Err("Image exceeds the 20 MB limit.".into()); }
    let bytes = STANDARD.decode(raw).map_err(|_| "Invalid image encoding.")?;
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Err("Expected a PNG image.".into()); }
    let (width, height) = ImageReader::with_format(Cursor::new(&bytes), ImageFormat::Png).into_dimensions().map_err(|_| "Invalid image.")?;
    if width == 0 || height == 0 || width > 20_000 || height > 20_000 { return Err("Invalid image.".into()); }
    if width as u64 * height as u64 > MAX_PIXELS { return Err("Image exceeds 40 megapixels.".into()); }
    Ok((bytes, width, height))
}
pub fn png_url(bytes: &[u8]) -> String { format!("data:image/png;base64,{}", STANDARD.encode(bytes)) }
pub fn encode_png(image: &RgbaImage, fast: bool) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    // Fast keeps a cheap row filter: flat screenshot areas still compress well at a fraction of the adaptive cost.
    let encoder = if fast { PngEncoder::new_with_quality(&mut out, CompressionType::Fast, FilterType::Up) } else { PngEncoder::new_with_quality(&mut out, CompressionType::Default, FilterType::Adaptive) };
    encoder.write_image(image.as_raw(), image.width(), image.height(), ExtendedColorType::Rgba8).map_err(|_| "Could not encode the image.")?;
    Ok(out)
}
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = path.with_extension("tmp");
    std::fs::write(&temp, bytes).map_err(|_| "Could not save the image. Check free disk space.")?;
    std::fs::rename(&temp, path).map_err(|_| { let _ = std::fs::remove_file(&temp); "Could not finish saving the image.".to_string() })
}

pub fn default_settings() -> Value {
    // Empty means use this build's public client. Never persist a build default as a user override.
    json!({"clientId": "", "shortcut": "CommandOrControl+Shift+Digit2", "theme": "system", "retentionDays": 30, "launchAtLogin": false, "sounds": true, "motion": true, "teamMemory": {}, "templates": null, "teamDefaults": {}, "autoUpdate": true, "adjustSelection": false, "magnifier": false, "copyOnCapture": false, "saveOnCapture": false, "captureDelay": 0})
}
/// Returns a complete, validated settings object. Unknown keys are dropped.
pub fn normalize_settings(input: &Value) -> Result<Value, String> {
    let mut out = default_settings();
    if let Some(v) = input.get("clientId") {
        let v = v.as_str().ok_or("Invalid client ID.")?.trim();
        if v.len() > 200 || !v.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') { return Err("The Linear client ID should contain only letters, numbers, dashes, or underscores.".into()); }
        out["clientId"] = json!(v);
    }
    if let Some(v) = input.get("shortcut") {
        let v = v.as_str().ok_or("Invalid shortcut.")?.trim();
        if v.is_empty() || v.len() > 80 || !v.chars().all(|c| c.is_ascii_alphanumeric() || c == '+') { return Err("Enter a shortcut such as CommandOrControl+Shift+Digit2.".into()); }
        out["shortcut"] = json!(v);
    }
    if let Some(v) = input.get("theme") {
        let v = v.as_str().ok_or("Invalid theme.")?;
        if !["system", "light", "dark", "paper", "blossom", "midnight", "graphite"].contains(&v) { return Err("Invalid theme.".into()); }
        out["theme"] = json!(v);
    }
    if let Some(v) = input.get("retentionDays") {
        let v = v.as_u64().filter(|d| *d <= 3650).ok_or("History retention must be between 0 and 3650 days.")?;
        out["retentionDays"] = json!(v);
    }
    if let Some(v) = input.get("launchAtLogin") { out["launchAtLogin"] = json!(v.as_bool().ok_or("Invalid login setting.")?); }
    if let Some(v) = input.get("sounds") { out["sounds"] = json!(v.as_bool().ok_or("Invalid sound setting.")?); }
    if let Some(v) = input.get("motion") { out["motion"] = json!(v.as_bool().ok_or("Invalid animation setting.")?); }
    if let Some(v) = input.get("autoUpdate") { out["autoUpdate"] = json!(v.as_bool().ok_or("Invalid update setting.")?); }
    for key in ["adjustSelection", "magnifier", "copyOnCapture", "saveOnCapture"] {
        if let Some(v) = input.get(key) { out[key] = json!(v.as_bool().ok_or("Invalid capture setting.")?); }
    }
    if let Some(v) = input.get("captureDelay") {
        let v = v.as_u64().filter(|d| [0, 3, 5, 10].contains(d)).ok_or("The capture delay must be 0, 3, 5 or 10 seconds.")?;
        out["captureDelay"] = json!(v);
    }
    if let Some(v) = input.get("teamMemory") {
        let map = v.as_object().ok_or("Invalid team memory.")?;
        let mut clean = Map::new();
        for (workspace, team) in map.iter().take(50) { clean.insert(id(workspace)?, json!(id(team.as_str().ok_or("Invalid team memory.")?)?)); }
        out["teamMemory"] = Value::Object(clean);
    }
    // Null keeps the built-in templates, so later versions can improve them for people who never edited them.
    if let Some(v) = input.get("templates").filter(|v| !v.is_null()) {
        let list = v.as_array().filter(|a| a.len() <= 20).ok_or("Keep up to 20 templates.")?;
        let mut clean = Vec::new();
        for t in list {
            let tid = t["id"].as_str().filter(|s| !s.is_empty() && s.len() <= 40 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')).ok_or("Invalid template.")?;
            let name = t["name"].as_str().map(str::trim).filter(|s| !s.is_empty() && s.chars().count() <= 60).ok_or("Give each template a name of up to 60 characters.")?;
            let body = t["body"].as_str().filter(|s| s.chars().count() <= 5000).ok_or("Keep each template under 5,000 characters.")?;
            clean.push(json!({"id": tid, "name": name, "body": body}));
        }
        out["templates"] = json!(clean);
    }
    // Issue details remembered per Linear team. The editor checks them against current team metadata before use.
    if let Some(v) = input.get("teamDefaults") {
        let map = v.as_object().ok_or("Invalid remembered issue details.")?;
        let mut clean = Map::new();
        for (team, d) in map.iter().take(100) {
            let optional = |key: &str| match d[key].as_str() { None | Some("") => Ok(String::new()), Some(s) => id(s) };
            let labels = match d["labelIds"].as_array() { Some(a) => a.iter().take(50).map(|l| id(l.as_str().unwrap_or(""))).collect::<Result<Vec<_>, _>>()?, None => Vec::new() };
            let priority = d["priority"].as_u64().filter(|p| *p <= 4).unwrap_or(0);
            clean.insert(id(team)?, json!({"projectId": optional("projectId")?, "assigneeId": optional("assigneeId")?, "labelIds": labels, "priority": priority}));
        }
        out["teamDefaults"] = Value::Object(clean);
    }
    Ok(out)
}
/// Stored preferences that no longer pass validation as a whole: every one that is still valid on its own is kept,
/// and only the others return to their defaults.
pub fn salvage_settings(stored: &Value) -> Value {
    let mut out = default_settings();
    for (key, value) in stored.as_object().into_iter().flatten() {
        let mut one = Map::new(); one.insert(key.clone(), value.clone());
        if let Some(valid) = normalize_settings(&Value::Object(one)).ok().and_then(|v| v.get(key).cloned()) { out[key.as_str()] = valid; }
    }
    out
}

impl Storage {
    pub fn record_cleanup<T>(&self, result: Result<T, String>) -> Result<T, String> {
        if let Ok(mut warning) = self.cleanup_error.lock() { *warning = result.as_ref().err().cloned(); }
        result
    }
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        Self::open_at(app.path().app_data_dir().map_err(|_| "Cannot locate app data.")?)
    }
    pub fn open_at(root: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(root.join("images")).map_err(|_| "Cannot create local draft storage.")?;
        let db = Connection::open(root.join("snipflag.sqlite")).map_err(|_| "Cannot open draft database.")?;
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
            CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, updated INTEGER NOT NULL, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY, workspace TEXT NOT NULL, state TEXT NOT NULL, result TEXT);
            CREATE TABLE IF NOT EXISTS deletions(id TEXT PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS submission_snapshots(id TEXT PRIMARY KEY, data TEXT NOT NULL);")
            .map_err(|_| "Cannot initialize draft database.")?;
        Ok(Self { root, db: Mutex::new(db), mutations: Mutex::new(()), cleanup_error: Mutex::new(None), rescan: AtomicBool::new(false) })
    }
    fn image_path(&self, session_id: &str, image_id: &str) -> PathBuf { self.root.join("images").join(format!("{session_id}-{image_id}.png")) }
    /// The draft as last saved, without pixels.
    fn stored(&self, session_id: &str) -> Result<Option<Value>, String> {
        let db = self.db.lock().map_err(|_| "Database unavailable.")?;
        let data: Option<String> = db.query_row("SELECT data FROM sessions WHERE id=?1", [session_id], |r| r.get(0)).optional().map_err(|_| "Cannot read draft.")?;
        Ok(data.and_then(|d| serde_json::from_str::<Value>(&d).ok()))
    }
    /// Persists session metadata. Image pixels are immutable per image ID, so data is only required for new images.
    pub fn save(&self, session: &Value) -> Result<(), String> {
        let result = self.save_checked(session);
        if result.is_err() { self.rescan.store(true, Ordering::SeqCst); }
        result
    }
    fn save_checked(&self, session: &Value) -> Result<(), String> {
        let _guard = self.mutations.lock().map_err(|_| "Draft storage unavailable.")?;
        let session_id = id(session["id"].as_str().ok_or("Missing session ID.")?)?;
        if self.deleting(&session_id)? { return Err("This draft is being deleted. Retry deletion in History.".into()); }
        if session["schemaVersion"] != 1 { return Err("Unsupported draft format.".into()); }
        let images = session["images"].as_array().ok_or("Missing image list.")?;
        if images.len() > MAX_IMAGES { return Err("A session can contain up to 10 images.".into()); }
        for field in ["title", "description"] { if session[field].as_str().unwrap_or("").len() > MAX_TEXT { return Err("Draft text is too long.".into()); } }
        // The History thumbnail is a small PNG data URL made by the editor from the flattened first screenshot.
        if let Some(preview) = session.get("preview").filter(|p| !p.is_null()) {
            let preview = preview.as_str().ok_or("Invalid draft preview.")?;
            if preview.len() > MAX_PREVIEW || !(preview.is_empty() || preview.starts_with("data:image/png;base64,")) { return Err("Invalid draft preview.".into()); }
        }
        let stored = self.stored(&session_id)?;
        if session["issue"].is_null() && stored.as_ref().is_some_and(|s| !s["issue"].is_null()) { return Err("This session was already sent to Linear and cannot be changed.".into()); }
        if self.submission(&session_id)?.is_some_and(|(_, state, _)| state == "creating" || state == "sent") {
            if let Some(snapshot) = self.snapshot(&session_id)? {
                if submission_content(&snapshot) != submission_content(session) { return Err("This report is locked to its submitted revision. Check the previous attempt before editing.".into()); }
            } else if session["issue"].is_null() { return Err("This older uncertain submission has no saved revision. Check it in Linear before starting a separate report.".into()); }
        }
        if let Some(histories) = session.get("annotationHistories") {
            let histories = histories.as_object().ok_or("Invalid annotation history.")?;
            if histories.len() > MAX_IMAGES { return Err("Too many image histories.".into()); }
            for (key, history) in histories {
                id(key)?;
                let past = history["past"].as_array().ok_or("Invalid undo history.")?;
                let future = history["future"].as_array().ok_or("Invalid redo history.")?;
                if past.len() + future.len() > 100 || history.to_string().len() > 2 * 1024 * 1024 { return Err("Annotation history exceeds its limit.".into()); }
                for snapshot in past.iter().chain(future) {
                    if snapshot.as_array().is_none_or(|s| s.len() > MAX_ANNOTATIONS) { return Err("Invalid history snapshot.".into()); }
                }
            }
        }
        let mut data = session.clone();
        if let Some(object) = data.as_object_mut() { object.remove("submissionLocked"); object.remove("deletionPending"); }
        let mut total = 0usize; let mut unique = HashSet::new();
        for (index, img) in images.iter().enumerate() {
            let image_id = id(img["id"].as_str().ok_or("Missing image ID.")?)?;
            if !unique.insert(image_id.clone()) { return Err("Duplicate image ID.".into()); }
            if img["annotations"].as_array().is_none_or(|a| a.len() > MAX_ANNOTATIONS) { return Err("Too many annotations on one image.".into()); }
            if img["name"].as_str().unwrap_or("").len() > 500 { return Err("Image caption is too long.".into()); }
            let path = self.image_path(&session_id, &image_id);
            if !path.exists() {
                let (bytes, width, height) = decode_png(img["dataUrl"].as_str().filter(|s| !s.is_empty()).ok_or("An image is missing its data. Add it again.")?)?;
                if Some(width as u64) != img["width"].as_u64() || Some(height as u64) != img["height"].as_u64() { return Err("Image dimensions do not match.".into()); }
                write_atomic(&path, &bytes)?;
            }
            total += std::fs::metadata(&path).map_err(|_| "Could not inspect saved image.")?.len() as usize;
            if total > MAX_SESSION_BYTES { return Err("Session exceeds 100 MB.".into()); }
            data["images"][index]["dataUrl"] = json!("");
        }
        let text = serde_json::to_string(&data).map_err(|_| "Cannot encode draft.")?;
        if text.len() > 8 * 1024 * 1024 { return Err("Annotation data exceeds the draft limit.".into()); }
        self.db.lock().map_err(|_| "Database unavailable.")?
            .execute("INSERT INTO sessions(id,updated,data) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,data=excluded.data", params![session_id, now(), text])
            .map_err(|_| "Could not save draft.")?;
        // Remove only this session's orphaned images after the new metadata is durable. The folder is read only when
        // there can be something to remove: an image left the draft, this is its first save, an earlier save failed
        // part-way, or an earlier cleanup is still unfinished.
        let dropped = stored.as_ref().and_then(|s| s["images"].as_array()).is_some_and(|before| before.iter().any(|img| img["id"].as_str().is_some_and(|i| !unique.contains(i))));
        let unfinished = self.cleanup_error.lock().map(|e| e.is_some()).unwrap_or(true);
        if dropped || stored.is_none() || unfinished || self.rescan.swap(false, Ordering::SeqCst) {
            self.record_cleanup(self.remove_images(&session_id, |image_id| !unique.contains(image_id)))?;
        }
        Ok(())
    }
    fn deleting(&self, session_id: &str) -> Result<bool, String> {
        self.db.lock().map_err(|_| "Database unavailable.")?.query_row("SELECT EXISTS(SELECT 1 FROM deletions WHERE id=?1)", [session_id], |r| r.get(0)).map_err(|_| "Cannot inspect deletion status.".into())
    }
    fn remove_images(&self, session_id: &str, remove: impl Fn(&str) -> bool) -> Result<(), String> {
        let entries = std::fs::read_dir(self.root.join("images")).map_err(|_| "Cannot inspect local screenshots for deletion.")?;
        let prefix = format!("{session_id}-");
        let mut failed = false;
        for entry in entries {
            let entry = entry.map_err(|_| "Cannot inspect local screenshots for deletion.")?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(image_id) = name.strip_prefix(&prefix).and_then(|s| s.strip_suffix(".png").or_else(|| s.strip_suffix(".tmp"))) {
                if id(image_id).is_ok() && remove(image_id) {
                    if let Err(error) = std::fs::remove_file(entry.path()) { if error.kind() != std::io::ErrorKind::NotFound { failed = true; } }
                }
            }
        }
        if failed { Err("Some local screenshots could not be deleted. Close apps using them and retry; deletion is not complete.".into()) } else { Ok(()) }
    }
    pub fn load(&self, session_id: &str) -> Result<Value, String> {
        let _guard = self.mutations.lock().map_err(|_| "Draft storage unavailable.")?;
        let session_id = id(session_id)?;
        if self.deleting(&session_id)? { return Err("Deletion is incomplete. Retry Delete in History.".into()); }
        let data: String = self.db.lock().map_err(|_| "Database unavailable.")?.query_row("SELECT data FROM sessions WHERE id=?1", [&session_id], |r| r.get(0)).map_err(|_| "Draft was not found.")?;
        let mut session: Value = serde_json::from_str(&data).map_err(|_| "Draft is damaged.")?;
        for img in session["images"].as_array_mut().ok_or("Draft is damaged.")? {
            let image_id = id(img["id"].as_str().ok_or("Invalid image ID.")?)?;
            let bytes = std::fs::read(self.image_path(&session_id, &image_id)).map_err(|_| "A draft image is missing.")?;
            img["dataUrl"] = json!(png_url(&bytes));
        }
        session["submissionLocked"] = json!(session["issue"].is_null() && self.submission(&session_id)?.is_some_and(|(_, state, _)| state == "creating" || state == "sent"));
        Ok(session)
    }
    pub fn list(&self) -> Result<Vec<Value>, String> {
        let db = self.db.lock().map_err(|_| "Database unavailable.")?;
        let mut stmt = db.prepare("SELECT data, EXISTS(SELECT 1 FROM deletions WHERE deletions.id=sessions.id), updated FROM sessions ORDER BY updated DESC LIMIT 200").map_err(|_| "Cannot list drafts.")?;
        let raw: Vec<(String, bool, i64)> = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).map_err(|_| "Cannot list drafts.")?.collect::<Result<_, _>>().map_err(|_| "Cannot read history.")?;
        let sessions = raw.iter().filter_map(|(r, deleting, updated)| serde_json::from_str::<Value>(r).ok().map(|v| (v, deleting, updated))).map(|(mut v, deleting, updated)| {
            v["deletionPending"] = json!(deleting);
            // History shows the time it sorts by: when the session was last saved, which opening it refreshes.
            v["updatedAt"] = json!(updated);
            v.as_object_mut().map(|o| o.remove("annotationHistories"));
            // History only needs a summary; annotations stay on disk until a draft is opened.
            if let Some(images) = v["images"].as_array_mut() { for img in images { img["annotations"] = json!([]); } }
            v
        }).collect();
        Ok(sessions)
    }
    pub fn delete(&self, session_id: &str) -> Result<(), String> {
        let _guard = self.mutations.lock().map_err(|_| "Draft storage unavailable.")?;
        let session_id = id(session_id)?;
        self.db.lock().map_err(|_| "Database unavailable.")?.execute("INSERT OR IGNORE INTO deletions(id) VALUES(?1)", [&session_id]).map_err(|_| "Could not begin draft deletion.")?;
        // Keep the history entry until all files are removed so a failed cleanup can be retried.
        self.remove_images(&session_id, |_| true)?;
        let mut db = self.db.lock().map_err(|_| "Database unavailable.")?;
        let tx = db.transaction().map_err(|_| "Could not finish draft deletion.")?;
        tx.execute("DELETE FROM submission_snapshots WHERE id=?1", [&session_id]).map_err(|_| "Could not delete the submitted revision.")?;
        tx.execute("DELETE FROM sessions WHERE id=?1", [&session_id]).map_err(|_| "Could not finish draft deletion.")?;
        tx.commit().map_err(|_| "Could not finish draft deletion.")?;
        // Receipts and tombstones prevent uncertain sends or stale autosaves from being replayed.
        Ok(())
    }
    /// Deletes drafts not updated within `days` days (0 keeps everything). Returns the number removed.
    pub fn prune(&self, days: u64) -> Result<usize, String> {
        if days == 0 { return Ok(0); }
        let cutoff = now().saturating_sub(days * 86_400_000);
        let ids: Vec<String> = {
            let db = self.db.lock().map_err(|_| "Database unavailable.")?;
            let mut stmt = db.prepare("SELECT id FROM sessions WHERE updated < ?1 AND id NOT IN (SELECT id FROM submissions WHERE state IN ('creating','uploading'))").map_err(|_| "Cannot read history.")?;
            let ids: Vec<String> = stmt.query_map([cutoff as i64], |r| r.get(0)).map_err(|_| "Cannot read history.")?.flatten().collect();
            ids
        };
        for session_id in &ids { self.delete(session_id)?; }
        Ok(ids.len())
    }
    pub fn clear(&self) -> Result<(), String> {
        let mut ids: HashSet<String> = {
            let db = self.db.lock().map_err(|_| "Database unavailable.")?;
            let mut stmt = db.prepare("SELECT id FROM sessions").map_err(|_| "Cannot read history.")?;
            let ids: HashSet<String> = stmt.query_map([], |r| r.get(0)).map_err(|_| "Cannot read history.")?.collect::<Result<_, _>>().map_err(|_| "Cannot read history.")?;
            ids
        };
        // Include files left by a save that failed before its metadata could be committed.
        for entry in std::fs::read_dir(self.root.join("images")).map_err(|_| "Cannot inspect local screenshots.")? {
            let name = entry.map_err(|_| "Cannot inspect local screenshots.")?.file_name().to_string_lossy().into_owned();
            if let Some((sid, tail)) = name.get(..36).zip(name.get(37..)).filter(|_| name.as_bytes().get(36) == Some(&b'-')) {
                if let Some(iid) = tail.strip_suffix(".png").or_else(|| tail.strip_suffix(".tmp")) {
                    if let (Ok(sid), Ok(_)) = (id(sid), id(iid)) { ids.insert(sid); }
                }
            }
        }
        let mut failure = None;
        for session_id in &ids { if let Err(error) = self.delete(session_id) { failure = Some(error); } }
        failure.map_or(Ok(()), Err)
    }
    pub fn settings(&self) -> Result<Value, String> {
        let db = self.db.lock().map_err(|_| "Database unavailable.")?;
        let data: Option<String> = db.query_row("SELECT data FROM settings WHERE key='preferences'", [], |r| r.get(0)).optional().map_err(|_| "Cannot read preferences.")?;
        match data {
            None => Ok(default_settings()),
            Some(data) => {
                let stored = serde_json::from_str::<Value>(&data).unwrap_or(Value::Null);
                Ok(normalize_settings(&stored).unwrap_or_else(|_| salvage_settings(&stored)))
            }
        }
    }
    pub fn write_settings(&self, value: &Value) -> Result<(), String> {
        self.db.lock().map_err(|_| "Database unavailable.")?
            .execute("INSERT INTO settings(key,data) VALUES('preferences',?1) ON CONFLICT(key) DO UPDATE SET data=excluded.data", [value.to_string()])
            .map_err(|_| "Could not save preferences.")?;
        Ok(())
    }
    pub fn submission(&self, session_id: &str) -> Result<Option<(String, String, Option<String>)>, String> {
        let db = self.db.lock().map_err(|_| "Database unavailable.")?;
        db.query_row("SELECT workspace,state,result FROM submissions WHERE id=?1", [session_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).optional().map_err(|_| "Cannot inspect previous submission.".into())
    }
    pub fn set_submission(&self, session_id: &str, workspace: &str, state: &str, result: Option<&str>) -> Result<(), String> {
        let _guard = self.mutations.lock().map_err(|_| "Draft storage unavailable.")?;
        if self.deleting(session_id)? { return Err("This draft was deleted; nothing new will be sent.".into()); }
        let mut db = self.db.lock().map_err(|_| "Database unavailable.")?;
        let tx = db.transaction().map_err(|_| "Cannot save submission state.")?;
        if state == "creating" {
            // Snapshot and unknown-outcome marker become durable together before issuing the mutation.
            let data: String = tx.query_row("SELECT data FROM sessions WHERE id=?1", [session_id], |r| r.get(0)).map_err(|_| "Save the report before submitting.")?;
            tx.execute("INSERT INTO submission_snapshots(id,data) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data", params![session_id, data]).map_err(|_| "Cannot save submitted revision.")?;
        }
        tx.execute("INSERT INTO submissions(id,workspace,state,result) VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET state=excluded.state,result=COALESCE(excluded.result,submissions.result)", params![session_id, workspace, state, result])
            .map_err(|_| "Cannot save submission state.")?;
        tx.commit().map_err(|_| "Cannot finish saving submission state.")?;
        Ok(())
    }
    pub fn snapshot(&self, session_id: &str) -> Result<Option<Value>, String> {
        let raw: Option<String> = self.db.lock().map_err(|_| "Database unavailable.")?.query_row("SELECT data FROM submission_snapshots WHERE id=?1", [session_id], |r| r.get(0)).optional().map_err(|_| "Cannot read submitted revision.")?;
        raw.map(|s| serde_json::from_str(&s).map_err(|_| "Submitted revision is damaged.".into())).transpose()
    }
}

/// Only report content is immutable; persistence timestamps and local undo history are not sent to Linear.
fn submission_content(session: &Value) -> Value {
    let mut content = session.clone();
    if let Some(object) = content.as_object_mut() {
        for key in ["updatedAt", "issue", "annotationHistories", "submissionLocked", "deletionPending", "preview"] { object.remove(key); }
    }
    if let Some(images) = content["images"].as_array_mut() { for image in images { image["dataUrl"] = json!(""); } }
    content
}

#[tauri::command]
pub fn save_session(window: WebviewWindow, state: State<Storage>, session: Value) -> Result<(), String> { main_only(&window)?; state.save(&session) }
#[tauri::command]
pub fn load_session(window: WebviewWindow, state: State<Storage>, id: String) -> Result<Value, String> { main_only(&window)?; state.load(&id) }
#[tauri::command]
pub fn list_sessions(window: WebviewWindow, state: State<Storage>) -> Result<Vec<Value>, String> { main_only(&window)?; state.list() }
#[tauri::command]
pub fn delete_session(window: WebviewWindow, state: State<Storage>, id: String) -> Result<(), String> { main_only(&window)?; state.record_cleanup(state.delete(&id)) }
#[tauri::command]
pub fn clear_history(window: WebviewWindow, state: State<Storage>) -> Result<(), String> { main_only(&window)?; state.record_cleanup(state.clear()) }
#[tauri::command]
pub fn load_settings(window: WebviewWindow, state: State<Storage>) -> Result<Value, String> { main_only(&window)?; state.settings() }
#[tauri::command]
pub fn submission_status(window: WebviewWindow, state: State<Storage>, id: String) -> Result<Value, String> {
    main_only(&window)?;
    let session_id = self::id(&id)?;
    Ok(match state.submission(&session_id)? { Some((_, status, _)) => json!({"state": status}), None => Value::Null })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn temp() -> Storage { Storage::open_at(std::env::temp_dir().join(format!("snipflag-test-{}", Uuid::new_v4()))).unwrap() }
    fn png(width: u32, height: u32) -> String { png_url(&encode_png(&RgbaImage::from_pixel(width, height, image::Rgba([255, 255, 255, 255])), false).unwrap()) }
    fn session(images: Vec<Value>) -> Value {
        json!({"schemaVersion":1,"id":Uuid::new_v4().to_string(),"title":"t","description":"","images":images,"issue":null})
    }
    fn image(width: u32, height: u32) -> Value { json!({"id":Uuid::new_v4().to_string(),"name":"a","width":width,"height":height,"dataUrl":png(width,height),"annotations":[]}) }

    #[test] fn ids_reject_paths() { assert!(id("../../secret").is_err()); assert!(id("C:\\secret").is_err()); assert!(id(&Uuid::new_v4().to_string()).is_ok()); }
    #[test] fn image_input_is_bounded_and_typed() {
        assert!(decode_png("data:text/plain;base64,SGVsbG8=").is_err());
        assert!(decode_png("data:image/png;base64,SGVsbG8=").is_err());
        let (_, w, h) = decode_png(&png(3, 2)).unwrap(); assert_eq!((w, h), (3, 2));
        // A PNG signature without a readable header is rejected.
        assert!(decode_png(&png_url(b"\x89PNG\r\n\x1a\nnot a header")).is_err());
    }
    #[test] fn session_round_trip_keeps_order_and_pixels() {
        let store = temp(); let s = session(vec![image(4, 3), image(2, 2)]);
        store.save(&s).unwrap();
        let loaded = store.load(s["id"].as_str().unwrap()).unwrap();
        assert_eq!(loaded["images"][0]["id"], s["images"][0]["id"]);
        assert_eq!(loaded["images"][1]["width"], 2);
        assert!(loaded["images"][0]["dataUrl"].as_str().unwrap().starts_with("data:image/png;base64,"));
        // Later saves may omit pixel data for images that are already durable.
        let mut light = s.clone(); light["images"][0]["dataUrl"] = json!(""); light["images"][1]["dataUrl"] = json!("");
        store.save(&light).unwrap();
    }
    #[test] fn mismatched_dimensions_and_duplicates_are_rejected() {
        let store = temp(); let mut img = image(4, 3); img["width"] = json!(5);
        assert!(store.save(&session(vec![img])).is_err());
        let dup = image(2, 2); assert!(store.save(&session(vec![dup.clone(), dup])).is_err());
        assert!(store.save(&session((0..11).map(|_| image(1, 1)).collect())).is_err());
    }
    #[test] fn removed_images_are_deleted_and_sent_sessions_are_immutable() {
        let store = temp(); let mut s = session(vec![image(2, 2), image(2, 2)]);
        store.save(&s).unwrap();
        let removed = s["images"][1]["id"].as_str().unwrap().to_string();
        s["images"] = json!([s["images"][0].clone()]); store.save(&s).unwrap();
        assert!(!store.image_path(s["id"].as_str().unwrap(), &removed).exists());
        s["issue"] = json!({"id":"x","identifier":"ENG-1","url":"https://linear.app/x"}); store.save(&s).unwrap();
        s["issue"] = Value::Null; assert!(store.save(&s).is_err());
    }
    #[test] fn history_shows_the_time_it_is_sorted_by() {
        let store = temp(); let mut s = session(vec![image(2, 2)]); s["updatedAt"] = json!(5);
        store.save(&s).unwrap();
        store.db.lock().unwrap().execute("UPDATE sessions SET updated=1234", []).unwrap();
        assert_eq!(store.list().unwrap()[0]["updatedAt"], 1234);
        assert_eq!(store.load(s["id"].as_str().unwrap()).unwrap()["updatedAt"], 5);
    }
    #[test] fn delete_keeps_submission_receipt() {
        let store = temp(); let s = session(vec![image(2, 2)]); let sid = s["id"].as_str().unwrap();
        store.save(&s).unwrap(); store.set_submission(sid, "w", "creating", None).unwrap();
        store.delete(sid).unwrap();
        assert!(store.load(sid).is_err());
        assert_eq!(store.submission(sid).unwrap().unwrap().1, "creating");
    }
    #[test] fn empty_session_removes_pixels_and_stays_empty_after_restart() {
        let store = temp(); let mut s = session(vec![image(2, 2)]); let sid = s["id"].as_str().unwrap().to_string();
        store.save(&s).unwrap(); s["images"] = json!([]); s["title"] = json!(""); store.save(&s).unwrap();
        let root = store.root.clone(); drop(store);
        let reopened = Storage::open_at(root).unwrap();
        assert_eq!(reopened.load(&sid).unwrap()["images"], json!([]));
        assert_eq!(std::fs::read_dir(reopened.root.join("images")).unwrap().count(), 0);
    }
    #[test] fn failed_deletion_is_visible_retryable_and_blocks_stale_saves() {
        let store = temp(); let s = session(vec![image(2, 2)]); let sid = s["id"].as_str().unwrap();
        store.save(&s).unwrap();
        // A directory at a managed image path deterministically makes remove_file fail on every OS.
        let blocked = store.image_path(sid, &Uuid::new_v4().to_string()); std::fs::create_dir(&blocked).unwrap();
        assert!(store.delete(sid).is_err());
        assert_eq!(store.list().unwrap()[0]["deletionPending"], true);
        assert!(store.save(&s).is_err()); assert!(store.load(sid).is_err());
        std::fs::remove_dir(blocked).unwrap(); store.delete(sid).unwrap();
        assert!(store.list().unwrap().is_empty()); assert!(store.save(&s).is_err());
    }
    #[test] fn clear_also_removes_orphaned_images_from_failed_saves() {
        let store = temp(); let s = session(vec![image(2, 2)]);
        let path = store.image_path(s["id"].as_str().unwrap(), s["images"][0]["id"].as_str().unwrap());
        std::fs::write(&path, b"orphan").unwrap();
        store.clear().unwrap(); assert!(!path.exists());
    }
    #[test] fn undo_history_round_trips_without_appearing_in_history_summaries() {
        let store = temp(); let mut s = session(vec![image(2, 2)]);
        let iid = s["images"][0]["id"].as_str().unwrap().to_string();
        s["annotationHistories"] = json!({iid: {"past":[[]],"future":[]}});
        store.save(&s).unwrap();
        assert_eq!(store.load(s["id"].as_str().unwrap()).unwrap()["annotationHistories"], s["annotationHistories"]);
        assert!(store.list().unwrap()[0].get("annotationHistories").is_none());
    }
    #[test] fn unknown_create_locks_exact_revision_across_restart_until_confirmed_absent() {
        let store = temp(); let mut s = session(vec![image(2, 2)]); let sid = s["id"].as_str().unwrap().to_string();
        store.save(&s).unwrap(); store.set_submission(&sid, "workspace", "creating", None).unwrap();
        let root = store.root.clone(); drop(store);
        let store = Storage::open_at(root).unwrap();
        assert_eq!(store.load(&sid).unwrap()["submissionLocked"], true);
        s["title"] = json!("Never sent"); assert!(store.save(&s).is_err());
        assert_eq!(store.snapshot(&sid).unwrap().unwrap()["title"], "t");
        store.set_submission(&sid, "workspace", "retryable", None).unwrap();
        store.save(&s).unwrap(); assert_eq!(store.load(&sid).unwrap()["submissionLocked"], false);
        store.set_submission(&sid, "workspace", "creating", None).unwrap();
        assert_eq!(store.snapshot(&sid).unwrap().unwrap()["title"], "Never sent");
    }
    #[test] fn confirmed_receipt_preserves_snapshot_and_retention_protects_uncertain_sends() {
        let store = temp(); let s = session(vec![image(2, 2)]); let sid = s["id"].as_str().unwrap();
        store.save(&s).unwrap(); store.set_submission(sid, "w", "creating", None).unwrap();
        store.db.lock().unwrap().execute("UPDATE sessions SET updated=0", []).unwrap();
        assert_eq!(store.prune(1).unwrap(), 0);
        let issue = json!({"id":sid,"identifier":"TEST-1","url":"https://linear.app/test"});
        store.set_submission(sid, "w", "sent", Some(&issue.to_string())).unwrap();
        let mut sent = store.snapshot(sid).unwrap().unwrap(); sent["issue"] = issue;
        store.save(&sent).unwrap();
        assert_eq!(store.load(sid).unwrap()["title"], "t");
        sent["title"] = json!("changed"); assert!(store.save(&sent).is_err());
        store.delete(sid).unwrap(); assert!(store.snapshot(sid).unwrap().is_none());
        assert!(store.submission(sid).unwrap().is_some());
    }
    #[test] fn history_previews_are_bounded_png_data_urls_and_not_report_content() {
        let dir = std::env::temp_dir().join(format!("snipflag-preview-{}", Uuid::new_v4()));
        let store = Storage::open_at(dir.clone()).unwrap();
        let sid = Uuid::new_v4().to_string();
        let mut s = json!({"schemaVersion":1,"id":sid,"title":"t","description":"","images":[image(4, 4)],"issue":null});
        s["preview"] = json!("data:image/png;base64,AAAA");
        store.save(&s).unwrap();
        assert_eq!(store.list().unwrap()[0]["preview"], "data:image/png;base64,AAAA");
        let mut changed = s.clone(); changed["preview"] = json!("");
        assert_eq!(submission_content(&s), submission_content(&changed));
        s["preview"] = json!("https://example.com/x.png"); assert!(store.save(&s).is_err());
        s["preview"] = json!(format!("data:image/png;base64,{}", "A".repeat(MAX_PREVIEW))); assert!(store.save(&s).is_err());
        s["preview"] = json!(7); assert!(store.save(&s).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }
    #[test] fn one_invalid_stored_setting_does_not_reset_the_others() {
        let stored = json!({"theme":"neon","shortcut":"Alt+KeyS","retentionDays":90,"templates":[{"id":"bug","name":"Bug","body":"x"}],"unknown":1});
        assert!(normalize_settings(&stored).is_err());
        let kept = salvage_settings(&stored);
        assert_eq!(kept["theme"], "system");
        assert_eq!(kept["shortcut"], "Alt+KeyS");
        assert_eq!(kept["retentionDays"], 90);
        assert_eq!(kept["templates"][0]["name"], "Bug");
        assert!(kept.get("unknown").is_none());
        assert_eq!(salvage_settings(&Value::Null), default_settings());
    }
    #[test] fn settings_are_validated() {
        assert!(normalize_settings(&json!({"clientId":"abc 123"})).is_err());
        assert!(normalize_settings(&json!({"theme":"neon"})).is_err());
        assert_eq!(normalize_settings(&json!({"theme":"midnight"})).unwrap()["theme"], "midnight");
        let capture = normalize_settings(&json!({"adjustSelection":true,"captureDelay":3})).unwrap();
        assert_eq!(capture["adjustSelection"], json!(true));
        assert_eq!(capture["magnifier"], json!(false));
        assert_eq!(capture["copyOnCapture"], json!(false));
        assert_eq!(capture["saveOnCapture"], json!(false));
        assert_eq!(normalize_settings(&json!({"saveOnCapture":true})).unwrap()["saveOnCapture"], json!(true));
        assert_eq!(capture["captureDelay"], json!(3));
        assert!(normalize_settings(&json!({"captureDelay":4})).is_err());
        assert!(normalize_settings(&json!({"magnifier":"yes"})).is_err());
        assert!(normalize_settings(&json!({"teamMemory":{"../x":"y"}})).is_err());
        let team = "00000000-0000-4000-8000-000000000001"; let label = "00000000-0000-4000-8000-000000000002";
        let kept = normalize_settings(&json!({"templates":[{"id":"bug","name":"  Bug  ","body":"## Steps"}],"teamDefaults":{team:{"projectId":"","labelIds":[label],"priority":2,"extra":1}}})).unwrap();
        assert_eq!(kept["templates"], json!([{"id":"bug","name":"Bug","body":"## Steps"}]));
        assert_eq!(kept["teamDefaults"][team], json!({"projectId":"","assigneeId":"","labelIds":[label],"priority":2}));
        assert!(normalize_settings(&json!({})).unwrap()["templates"].is_null());
        assert!(normalize_settings(&json!({"templates":[{"id":"x","name":" ","body":""}]})).is_err());
        assert!(normalize_settings(&json!({"templates":[{"id":"../x","name":"A","body":""}]})).is_err());
        assert!(normalize_settings(&json!({"teamDefaults":{team:{"projectId":"../p"}}})).is_err());
        let ok = normalize_settings(&json!({"clientId":"abc123","retentionDays":7,"extra":true})).unwrap();
        assert_eq!(ok["retentionDays"], 7); assert!(ok.get("extra").is_none());
        assert_eq!(ok["sounds"], true); assert_eq!(ok["motion"], true); assert_eq!(ok["autoUpdate"], true);
        assert_eq!(normalize_settings(&json!({"autoUpdate":false})).unwrap()["autoUpdate"], false);
        assert!(normalize_settings(&json!({"autoUpdate":"yes"})).is_err());
        let quiet = normalize_settings(&json!({"sounds":false,"motion":false})).unwrap();
        assert_eq!(quiet["sounds"], false); assert_eq!(quiet["motion"], false);
        assert!(normalize_settings(&json!({"sounds":"loud"})).is_err());
    }
}
