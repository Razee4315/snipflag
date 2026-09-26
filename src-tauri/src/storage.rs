use base64::{engine::general_purpose::STANDARD, Engine};
use image::{codecs::png::{CompressionType, FilterType, PngEncoder}, DynamicImage, ExtendedColorType, ImageEncoder, ImageFormat, ImageReader, RgbaImage};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Map, Value};
use std::{collections::HashSet, io::Cursor, path::{Path, PathBuf}, sync::Mutex};
use tauri::{AppHandle, Manager, State, WebviewWindow};
use uuid::Uuid;

pub const MAX_IMAGES: usize = 10;
pub const MAX_IMAGE_BYTES: usize = 20 * 1024 * 1024;
pub const MAX_SESSION_BYTES: usize = 100 * 1024 * 1024;
pub const MAX_PIXELS: u64 = 40_000_000;
const MAX_ANNOTATIONS: usize = 2000;
const MAX_TEXT: usize = 100_000;

pub struct Storage { pub root: PathBuf, pub db: Mutex<Connection> }

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
/// Validates a PNG data URL and returns its encoded bytes plus dimensions.
pub fn decode_png(value: &str) -> Result<(Vec<u8>, u32, u32), String> {
    let raw = value.strip_prefix("data:image/png;base64,").ok_or("Expected a PNG image.")?;
    if raw.len() > MAX_IMAGE_BYTES / 3 * 4 + 8 { return Err("Image exceeds the 20 MB limit.".into()); }
    let bytes = STANDARD.decode(raw).map_err(|_| "Invalid image encoding.")?;
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Err("Expected a PNG image.".into()); }
    let image = decode_image(&bytes)?;
    let (width, height) = (image.width(), image.height());
    Ok((bytes, width, height))
}
pub fn png_url(bytes: &[u8]) -> String { format!("data:image/png;base64,{}", STANDARD.encode(bytes)) }
pub fn encode_png(image: &RgbaImage, fast: bool) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let encoder = if fast { PngEncoder::new_with_quality(&mut out, CompressionType::Fast, FilterType::NoFilter) } else { PngEncoder::new_with_quality(&mut out, CompressionType::Default, FilterType::Adaptive) };
    encoder.write_image(image.as_raw(), image.width(), image.height(), ExtendedColorType::Rgba8).map_err(|_| "Could not encode the image.")?;
    Ok(out)
}
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = path.with_extension("tmp");
    std::fs::write(&temp, bytes).map_err(|_| "Could not save the image. Check free disk space.")?;
    std::fs::rename(&temp, path).map_err(|_| { let _ = std::fs::remove_file(&temp); "Could not finish saving the image.".to_string() })
}

pub fn default_settings() -> Value {
    // The Linear OAuth client ID is public. Builds may embed one; otherwise the owner enters it in Settings.
    json!({"clientId": option_env!("SNIPFLAG_LINEAR_CLIENT_ID").unwrap_or(""), "shortcut": "CommandOrControl+Shift+Digit2", "theme": "system", "retentionDays": 30, "launchAtLogin": false, "teamMemory": {}})
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
        if !["system", "light", "dark"].contains(&v) { return Err("Invalid theme.".into()); }
        out["theme"] = json!(v);
    }
    if let Some(v) = input.get("retentionDays") {
        let v = v.as_u64().filter(|d| *d <= 3650).ok_or("History retention must be between 0 and 3650 days.")?;
        out["retentionDays"] = json!(v);
    }
    if let Some(v) = input.get("launchAtLogin") { out["launchAtLogin"] = json!(v.as_bool().ok_or("Invalid login setting.")?); }
    if let Some(v) = input.get("teamMemory") {
        let map = v.as_object().ok_or("Invalid team memory.")?;
        let mut clean = Map::new();
        for (workspace, team) in map.iter().take(50) { clean.insert(id(workspace)?, json!(id(team.as_str().ok_or("Invalid team memory.")?)?)); }
        out["teamMemory"] = Value::Object(clean);
    }
    Ok(out)
}

impl Storage {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        Self::open_at(app.path().app_data_dir().map_err(|_| "Cannot locate app data.")?)
    }
    pub fn open_at(root: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(root.join("images")).map_err(|_| "Cannot create local draft storage.")?;
        let db = Connection::open(root.join("snipflag.sqlite")).map_err(|_| "Cannot open draft database.")?;
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
            CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, updated INTEGER NOT NULL, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY, workspace TEXT NOT NULL, state TEXT NOT NULL, result TEXT);")
            .map_err(|_| "Cannot initialize draft database.")?;
        Ok(Self { root, db: Mutex::new(db) })
    }
    fn image_path(&self, session_id: &str, image_id: &str) -> PathBuf { self.root.join("images").join(format!("{session_id}-{image_id}.png")) }
    fn stored_issue(&self, session_id: &str) -> Result<Option<Value>, String> {
        let db = self.db.lock().map_err(|_| "Database unavailable.")?;
        let data: Option<String> = db.query_row("SELECT data FROM sessions WHERE id=?1", [session_id], |r| r.get(0)).optional().map_err(|_| "Cannot read draft.")?;
        Ok(data.and_then(|d| serde_json::from_str::<Value>(&d).ok()).map(|v| v["issue"].clone()).filter(|v| !v.is_null()))
    }
    /// Persists session metadata. Image pixels are immutable per image ID, so data is only required for new images.
    pub fn save(&self, session: &Value) -> Result<(), String> {
        let session_id = id(session["id"].as_str().ok_or("Missing session ID.")?)?;
        if session["schemaVersion"] != 1 { return Err("Unsupported draft format.".into()); }
        let images = session["images"].as_array().ok_or("Missing image list.")?;
        if images.len() > MAX_IMAGES { return Err("A session can contain up to 10 images.".into()); }
        for field in ["title", "description"] { if session[field].as_str().unwrap_or("").len() > MAX_TEXT { return Err("Draft text is too long.".into()); } }
        if session["issue"].is_null() && self.stored_issue(&session_id)?.is_some() { return Err("This session was already sent to Linear and cannot be changed.".into()); }
        let mut data = session.clone(); let mut total = 0usize; let mut unique = HashSet::new();
        for (index, img) in images.iter().enumerate() {
            let image_id = id(img["id"].as_str().ok_or("Missing image ID.")?)?;
            if !unique.insert(image_id.clone()) { return Err("Duplicate image ID.".into()); }
            if img["annotations"].as_array().map_or(true, |a| a.len() > MAX_ANNOTATIONS) { return Err("Too many annotations on one image.".into()); }
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
        // Remove only this session's orphaned images after the new metadata is durable.
        self.remove_images(&session_id, |image_id| !unique.contains(image_id));
        Ok(())
    }
    fn remove_images(&self, session_id: &str, remove: impl Fn(&str) -> bool) {
        let Ok(entries) = std::fs::read_dir(self.root.join("images")) else { return };
        let prefix = format!("{session_id}-");
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(image_id) = name.strip_prefix(&prefix).and_then(|s| s.strip_suffix(".png").or_else(|| s.strip_suffix(".tmp"))) {
                if remove(image_id) { let _ = std::fs::remove_file(entry.path()); }
            }
        }
    }
    pub fn load(&self, session_id: &str) -> Result<Value, String> {
        let session_id = id(session_id)?;
        let data: String = self.db.lock().map_err(|_| "Database unavailable.")?.query_row("SELECT data FROM sessions WHERE id=?1", [&session_id], |r| r.get(0)).map_err(|_| "Draft was not found.")?;
        let mut session: Value = serde_json::from_str(&data).map_err(|_| "Draft is damaged.")?;
        for img in session["images"].as_array_mut().ok_or("Draft is damaged.")? {
            let image_id = id(img["id"].as_str().ok_or("Invalid image ID.")?)?;
            let bytes = std::fs::read(self.image_path(&session_id, &image_id)).map_err(|_| "A draft image is missing.")?;
            img["dataUrl"] = json!(png_url(&bytes));
        }
        Ok(session)
    }
    pub fn list(&self) -> Result<Vec<Value>, String> {
        let db = self.db.lock().map_err(|_| "Database unavailable.")?;
        let mut stmt = db.prepare("SELECT data FROM sessions ORDER BY updated DESC LIMIT 200").map_err(|_| "Cannot list drafts.")?;
        let raw: Vec<String> = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(|_| "Cannot list drafts.")?.flatten().collect();
        let sessions = raw.iter().filter_map(|r| serde_json::from_str::<Value>(r).ok()).map(|mut v| {
            // History only needs a summary; annotations stay on disk until a draft is opened.
            if let Some(images) = v["images"].as_array_mut() { for img in images { img["annotations"] = json!([]); } }
            v
        }).collect();
        Ok(sessions)
    }
    pub fn delete(&self, session_id: &str) -> Result<(), String> {
        let session_id = id(session_id)?;
        self.db.lock().map_err(|_| "Database unavailable.")?.execute("DELETE FROM sessions WHERE id=?1", [&session_id]).map_err(|_| "Could not delete draft.")?;
        // Keep submission receipts so deleting a draft cannot make an uncertain send replayable.
        self.remove_images(&session_id, |_| true);
        Ok(())
    }
    /// Deletes drafts not updated within `days` days (0 keeps everything). Returns the number removed.
    pub fn prune(&self, days: u64) -> Result<usize, String> {
        if days == 0 { return Ok(0); }
        let cutoff = now().saturating_sub(days * 86_400_000);
        let ids: Vec<String> = {
            let db = self.db.lock().map_err(|_| "Database unavailable.")?;
            let mut stmt = db.prepare("SELECT id FROM sessions WHERE updated < ?1").map_err(|_| "Cannot read history.")?;
            let ids: Vec<String> = stmt.query_map([cutoff as i64], |r| r.get(0)).map_err(|_| "Cannot read history.")?.flatten().collect();
            ids
        };
        for session_id in &ids { self.delete(session_id)?; }
        Ok(ids.len())
    }
    pub fn clear(&self) -> Result<(), String> {
        let ids: Vec<String> = {
            let db = self.db.lock().map_err(|_| "Database unavailable.")?;
            let mut stmt = db.prepare("SELECT id FROM sessions").map_err(|_| "Cannot read history.")?;
            let ids: Vec<String> = stmt.query_map([], |r| r.get(0)).map_err(|_| "Cannot read history.")?.flatten().collect();
            ids
        };
        for session_id in &ids { self.delete(session_id)?; }
        Ok(())
    }
    pub fn settings(&self) -> Result<Value, String> {
        let db = self.db.lock().map_err(|_| "Database unavailable.")?;
        let data: Option<String> = db.query_row("SELECT data FROM settings WHERE key='preferences'", [], |r| r.get(0)).optional().map_err(|_| "Cannot read preferences.")?;
        match data {
            None => Ok(default_settings()),
            Some(data) => normalize_settings(&serde_json::from_str::<Value>(&data).unwrap_or(Value::Null)).or_else(|_| Ok(default_settings())),
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
        self.db.lock().map_err(|_| "Database unavailable.")?
            .execute("INSERT INTO submissions(id,workspace,state,result) VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET state=excluded.state,result=COALESCE(excluded.result,submissions.result)", params![session_id, workspace, state, result])
            .map_err(|_| "Cannot save submission state.")?;
        Ok(())
    }
}

#[tauri::command]
pub fn save_session(window: WebviewWindow, state: State<Storage>, session: Value) -> Result<(), String> { main_only(&window)?; state.save(&session) }
#[tauri::command]
pub fn load_session(window: WebviewWindow, state: State<Storage>, id: String) -> Result<Value, String> { main_only(&window)?; state.load(&id) }
#[tauri::command]
pub fn list_sessions(window: WebviewWindow, state: State<Storage>) -> Result<Vec<Value>, String> { main_only(&window)?; state.list() }
#[tauri::command]
pub fn delete_session(window: WebviewWindow, state: State<Storage>, id: String) -> Result<(), String> { main_only(&window)?; state.delete(&id) }
#[tauri::command]
pub fn clear_history(window: WebviewWindow, state: State<Storage>) -> Result<(), String> { main_only(&window)?; state.clear() }
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
    #[test] fn delete_keeps_submission_receipt() {
        let store = temp(); let s = session(vec![image(2, 2)]); let sid = s["id"].as_str().unwrap();
        store.save(&s).unwrap(); store.set_submission(sid, "w", "creating", None).unwrap();
        store.delete(sid).unwrap();
        assert!(store.load(sid).is_err());
        assert_eq!(store.submission(sid).unwrap().unwrap().1, "creating");
    }
    #[test] fn settings_are_validated() {
        assert!(normalize_settings(&json!({"clientId":"abc 123"})).is_err());
        assert!(normalize_settings(&json!({"theme":"neon"})).is_err());
        assert!(normalize_settings(&json!({"teamMemory":{"../x":"y"}})).is_err());
        let ok = normalize_settings(&json!({"clientId":"abc123","retentionDays":7,"extra":true})).unwrap();
        assert_eq!(ok["retentionDays"], 7); assert!(ok.get("extra").is_none());
    }
}
