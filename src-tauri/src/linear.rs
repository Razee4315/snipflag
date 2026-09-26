use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;
use crate::{auth::{access_token, client, is_connected, NetworkLock}, storage::{decode_png, id, main_only, Storage, MAX_IMAGES, MAX_SESSION_BYTES}};

/// Sends a GraphQL request and returns the full body (data and errors) after transport-level checks.
async fn request(token: &str, query: &str, variables: Value) -> Result<Value, String> {
    let response = client()?.post("https://api.linear.app/graphql").bearer_auth(token).json(&json!({"query": query, "variables": variables})).send().await
        .map_err(|_| "Linear could not be reached. Your draft is safe; check your connection.")?;
    match response.status().as_u16() {
        429 => return Err("Linear is rate limiting requests. Wait a minute and try again.".into()),
        401 => return Err("Your Linear connection has expired or was revoked. Reconnect in Settings.".into()),
        403 => return Err("Linear denied access. Check that your account can use this team, then reconnect.".into()),
        // Linear reports GraphQL validation errors with HTTP 400 and a JSON body.
        s if !(200..300).contains(&s) && s != 400 => return Err(format!("Linear returned HTTP {s}. Your draft has been kept.")),
        _ => {}
    }
    response.json().await.map_err(|_| "Linear returned an invalid response.".into())
}
fn first_error(body: &Value) -> Option<&Value> { body["errors"].as_array().and_then(|a| a.first()) }
fn is_not_found(body: &Value) -> bool {
    first_error(body).is_some_and(|e| e["message"].as_str().unwrap_or("").to_ascii_lowercase().contains("not found") || e["extensions"]["code"] == "ENTITY_NOT_FOUND")
}
fn describe_error(body: &Value) -> String {
    let error = first_error(body).cloned().unwrap_or(Value::Null);
    if error["extensions"]["code"] == "RATELIMITED" { return "Linear is rate limiting requests. Wait a minute and try again.".into(); }
    if error["extensions"]["code"] == "AUTHENTICATION_ERROR" { return "Your Linear connection has expired or was revoked. Reconnect in Settings.".into(); }
    // Only Linear's user-facing message is shown; never echo variables, tokens, or signed URLs.
    match error["extensions"]["userPresentableMessage"].as_str() {
        Some(message) => format!("Linear: {}", message.chars().take(200).collect::<String>()),
        None => "Linear rejected the request. Check your team access and selected fields; reconnect if needed.".into(),
    }
}
async fn graphql(token: &str, query: &str, variables: Value) -> Result<Value, String> {
    let body = request(token, query, variables).await?;
    if first_error(&body).is_some() { return Err(describe_error(&body)); }
    body.get("data").cloned().filter(|d| !d.is_null()).ok_or_else(|| "Linear returned no data.".into())
}
async fn identity(token: &str) -> Result<Value, String> {
    graphql(token, "query { viewer { id name } organization { id name urlKey } }", json!({})).await
}
async fn paginate(token: &str, query: &str, variables: Value, path: &[&str]) -> Result<Vec<Value>, String> {
    let mut nodes = Vec::new(); let mut cursor = Value::Null;
    for _ in 0..50 {
        let mut vars = variables.clone(); vars["after"] = cursor.clone();
        let data = graphql(token, query, vars).await?;
        let mut connection = &data; for key in path { connection = &connection[*key]; }
        nodes.extend(connection["nodes"].as_array().ok_or("Linear data was not available.")?.iter().cloned());
        if connection["pageInfo"]["hasNextPage"] != true { return Ok(nodes); }
        let next = connection["pageInfo"]["endCursor"].clone();
        if next.is_null() || next == cursor { return Err("Linear pagination did not advance.".into()); }
        cursor = next;
    }
    Ok(nodes)
}

#[tauri::command]
pub async fn linear_connection(window: WebviewWindow, app: AppHandle) -> Result<Value, String> {
    main_only(&window)?;
    if !is_connected()? { return Ok(Value::Null); }
    let lock = app.state::<NetworkLock>(); let _guard = lock.0.lock().await;
    let token = access_token().await?;
    let who = identity(&token).await?;
    let teams = paginate(&token, "query($after:String) { teams(first:100,after:$after) { nodes { id name key } pageInfo { hasNextPage endCursor } } }", json!({}), &["teams"]).await?;
    Ok(json!({"name": who["viewer"]["name"], "workspace": who["organization"]["name"], "workspaceId": who["organization"]["id"], "teams": teams}))
}
#[tauri::command]
pub async fn linear_team_options(window: WebviewWindow, app: AppHandle, team_id: String) -> Result<Value, String> {
    main_only(&window)?; let team_id = id(&team_id)?;
    let lock = app.state::<NetworkLock>(); let _guard = lock.0.lock().await;
    let token = access_token().await?;
    let mut result = json!({});
    for (field, fields) in [("projects", "id name"), ("members", "id name displayName"), ("labels", "id name color")] {
        // Field names are compiled constants; user values are always GraphQL variables.
        let query = format!("query($id:String!,$after:String) {{ team(id:$id) {{ {field}(first:100,after:$after) {{ nodes {{ {fields} }} pageInfo {{ hasNextPage endCursor }} }} }} }}");
        result[field] = json!(paginate(&token, &query, json!({"id": team_id}), &["team", field]).await?);
    }
    Ok(result)
}

pub fn markdown_caption(text: &str) -> String {
    text.chars().take(200).map(|c| if "\\`*_{}[]<>#|!".contains(c) { format!("\\{c}") } else if c == '\n' || c == '\r' { " ".into() } else { c.to_string() }).collect()
}
/// Builds the issue description with one ordered section per screenshot.
pub fn build_description(description: &str, sections: &[(String, String)]) -> String {
    let mut out = description.trim_end().to_owned();
    for (i, (caption, url)) in sections.iter().enumerate() {
        let caption = markdown_caption(caption.trim());
        let heading = if caption.is_empty() { format!("Screenshot {}", i + 1) } else { caption };
        if !out.is_empty() { out.push_str("\n\n"); }
        out.push_str(&format!("### {}. {}\n\n![Screenshot {}]({})", i + 1, heading, i + 1, url));
    }
    out
}

/// The exact description sent to Linear: resolved prose, then one ordered section per image.
/// Mirrored by src/report.ts for the local preview; both are checked against src/report.fixtures.json.
pub fn compose_description(session: &Value, images: &[Value], refs: &crate::mentions::References, uploaded: &[(String, String)]) -> Result<String, String> {
    let aliased = session["imageReferences"].is_object();
    let mut sections = Vec::new();
    for image in images {
        let image_id = image["id"].as_str().unwrap_or_default();
        let url = uploaded.iter().find(|(id, _)| id == image_id).map(|(_, url)| url.clone()).ok_or("A screenshot was not uploaded.")?;
        let caption = image["name"].as_str().unwrap_or("");
        let alias = refs.iter().find(|(_, id)| id.as_str() == image_id).map(|(key, _)| key.as_str());
        let caption = match alias {
            Some(key) if aliased => if caption.is_empty() { format!("@{key}") } else { format!("@{key} · {caption}") },
            _ => caption.to_string(),
        };
        sections.push((caption, url));
    }
    let prose = crate::mentions::resolve(session["description"].as_str().unwrap_or(""), refs, uploaded)?;
    Ok(build_description(&prose, &sections))
}

#[derive(Debug, PartialEq)]
pub enum Plan { Fresh, Receipt(String), Reconcile, WrongWorkspace }
/// Decides what a submit attempt may do based on the durable receipt from earlier attempts.
pub fn plan(receipt: Option<(&str, &str, Option<&str>)>, workspace: &str) -> Plan {
    match receipt {
        None => Plan::Fresh,
        Some((w, _, _)) if w != workspace => Plan::WrongWorkspace,
        Some((_, _, Some(result))) => Plan::Receipt(result.to_string()),
        Some((_, "creating", None)) => Plan::Reconcile,
        Some(_) => Plan::Fresh,
    }
}

fn progress(app: &AppHandle, message: &str) { let _ = app.emit_to("main", "submission-progress", message); }
async fn upload(token: &str, bytes: Vec<u8>, index: usize) -> Result<String, String> {
    let data = graphql(token, "mutation($type:String!,$name:String!,$size:Int!) { fileUpload(contentType:$type,filename:$name,size:$size) { success uploadFile { uploadUrl assetUrl headers { key value } } } }",
        json!({"type": "image/png", "name": format!("screenshot-{}.png", index + 1), "size": bytes.len()})).await?;
    if data["fileUpload"]["success"] != true { return Err("Linear could not prepare the screenshot upload.".into()); }
    let file = &data["fileUpload"]["uploadFile"];
    let url = url::Url::parse(file["uploadUrl"].as_str().ok_or("Upload URL missing.")?).map_err(|_| "Invalid upload URL.")?;
    if url.scheme() != "https" || url.host_str().is_none() || !url.username().is_empty() { return Err("Linear returned an unsupported upload destination.".into()); }
    let asset = file["assetUrl"].as_str().ok_or("Uploaded image URL missing.")?;
    let asset_url = url::Url::parse(asset).map_err(|_| "Invalid image URL.")?;
    if asset_url.scheme() != "https" || !asset_url.host_str().is_some_and(|h| h == "uploads.linear.app" || h.ends_with(".linear.app")) { return Err("Unexpected Linear image storage address.".into()); }
    // The storage host receives only Linear's signed headers, never the OAuth bearer token.
    let mut request = client()?.put(url).header("Content-Type", "image/png").header("Cache-Control", "public, max-age=31536000");
    for header in file["headers"].as_array().ok_or("Upload headers missing.")? {
        let key = header["key"].as_str().ok_or("Invalid upload header.")?;
        if key.eq_ignore_ascii_case("authorization") || key.eq_ignore_ascii_case("host") { return Err("Unexpected upload authorization header.".into()); }
        request = request.header(key, header["value"].as_str().ok_or("Invalid upload header value.")?);
    }
    let response = request.body(bytes).send().await.map_err(|_| "Screenshot upload was interrupted. Your draft is saved.")?;
    if !response.status().is_success() { return Err("Screenshot upload failed. Your draft is saved; retry when connected.".into()); }
    Ok(asset.into())
}
fn complete(app: &AppHandle, workspace: &str, mut session: Value, result: Value) -> Result<Value, String> {
    let storage = app.state::<Storage>();
    let issue = json!({"id": result["id"], "identifier": result["identifier"], "url": result["url"]});
    let sid = session["id"].as_str().unwrap_or_default().to_string();
    storage.set_submission(&sid, workspace, "sent", Some(&issue.to_string())).map_err(|_| "The issue exists, but the receipt could not be saved. Retry will reconcile it.")?;
    session["issue"] = issue.clone();
    storage.save(&session)?;
    Ok(issue)
}

/// Checks only the immutable attempted revision. A confirmed absence unlocks the draft without sending again.
async fn reconcile_attempt(app: &AppHandle, session_id: &str, receipt: (String, String, Option<String>)) -> Result<Option<Value>, String> {
    let token = access_token().await?;
    let who = identity(&token).await?;
    let workspace = who["organization"]["id"].as_str().ok_or("Workspace is unavailable.")?;
    let decision = plan(Some((&receipt.0, &receipt.1, receipt.2.as_deref())), workspace);
    if decision == Plan::WrongWorkspace { return Err("Reconnect the original workspace to check this report. Nothing new was sent.".into()); }
    let storage = app.state::<Storage>();
    let snapshot = storage.snapshot(session_id)?.ok_or("This older uncertain submission has no saved original revision. Review it in Linear before starting a separate report. Nothing new was sent.")?;
    match decision {
        Plan::Receipt(result) => complete(app, workspace, snapshot, serde_json::from_str(&result).map_err(|_| "Submission receipt is damaged.")?).map(Some),
        Plan::Reconcile => {
            progress(app, "Checking the exact report from the previous attempt…");
            let body = request(&token, "query($id:String!) { issue(id:$id) { id identifier url } }", json!({"id": session_id})).await?;
            if !body["data"]["issue"].is_null() { return complete(app, workspace, snapshot, body["data"]["issue"].clone()).map(Some); }
            if !is_not_found(&body) { return Err(format!("{} The previous attempt is still unconfirmed; nothing new was sent.", describe_error(&body))); }
            storage.set_submission(session_id, workspace, "retryable", None)?;
            Ok(None)
        }
        _ => Err("There is no uncertain submission to check.".into()),
    }
}

#[tauri::command]
pub async fn reconcile_issue(window: WebviewWindow, app: AppHandle, id: String) -> Result<Option<Value>, String> {
    main_only(&window)?; let session_id = crate::storage::id(&id)?;
    let lock = app.state::<NetworkLock>(); let _guard = lock.0.try_lock().map_err(|_| "Another Linear operation is in progress. Please wait.")?;
    let receipt = app.state::<Storage>().submission(&session_id)?.ok_or("There is no previous submission to check.")?;
    reconcile_attempt(&app, &session_id, receipt).await
}

#[tauri::command]
pub async fn submit_issue(window: WebviewWindow, app: AppHandle, session: Value, exports: Vec<Value>) -> Result<Value, String> {
    main_only(&window)?;
    let lock = app.state::<NetworkLock>();
    let _guard = lock.0.try_lock().map_err(|_| "Another Linear operation is in progress. Please wait.")?;
    let session_id = id(session["id"].as_str().ok_or("Missing session ID.")?)?;
    if let Some(receipt) = app.state::<Storage>().submission(&session_id)? {
        if receipt.1 == "creating" || receipt.1 == "sent" {
            return reconcile_attempt(&app, &session_id, receipt).await?.ok_or_else(|| "Linear confirmed no issue exists. Review the report, then choose Create issue to send it.".into());
        }
    }
    let team_id = id(session["teamId"].as_str().filter(|s| !s.is_empty()).ok_or("Choose a Linear team.")?)?;
    let title = session["title"].as_str().map(str::trim).filter(|s| !s.is_empty() && s.chars().count() <= 250).ok_or("Enter a title under 250 characters.")?.to_string();
    let images = session["images"].as_array().ok_or("Missing screenshots.")?.clone();
    if images.is_empty() || images.len() > MAX_IMAGES { return Err("Add between 1 and 10 screenshots.".into()); }
    if images.len() != exports.len() { return Err("Every screenshot must be exported before sending.".into()); }
    let image_references = crate::mentions::references(&session, &images)?;
    crate::mentions::validate(session["description"].as_str().unwrap_or(""), &image_references, &images)?;
    if !session["issue"].is_null() { return Err("This session has already been sent.".into()); }
    let priority = session["priority"].as_u64().filter(|p| *p <= 4).unwrap_or(0);
    let labels: Vec<String> = session["labelIds"].as_array().map(|a| a.iter().take(50).filter_map(|v| v.as_str()).map(id).collect::<Result<_, _>>()).transpose()?.unwrap_or_default();
    // Validate every export before persisting or contacting Linear.
    let mut decoded = Vec::new(); let mut total = 0usize;
    for (image, export) in images.iter().zip(&exports) {
        if export["id"] != image["id"] { return Err("Image order changed. Please try sending again.".into()); }
        let (bytes, width, height) = decode_png(export["dataUrl"].as_str().ok_or("Missing image export.")?)?;
        if Some(width as u64) != image["width"].as_u64() || Some(height as u64) != image["height"].as_u64() { return Err("An exported screenshot has the wrong size.".into()); }
        total += bytes.len(); if total > MAX_SESSION_BYTES { return Err("Exported session exceeds 100 MB.".into()); }
        decoded.push(bytes);
    }
    let storage = app.state::<Storage>();
    storage.save(&session)?;
    progress(&app, "Checking your Linear connection…");
    let token = access_token().await?;
    let who = identity(&token).await?;
    let workspace = who["organization"]["id"].as_str().ok_or("Workspace is unavailable.")?.to_string();
    let receipt = storage.submission(&session_id)?;
    match plan(receipt.as_ref().map(|(w, s, r)| (w.as_str(), s.as_str(), r.as_deref())), &workspace) {
        Plan::WrongWorkspace => return Err("This draft was previously sent from another workspace. Reconnect that workspace to reconcile it.".into()),
        Plan::Receipt(_) | Plan::Reconcile => return Err("Check the previous attempt before sending this report.".into()),
        Plan::Fresh => {}
    }
    storage.set_submission(&session_id, &workspace, "uploading", None)?;
    let count = decoded.len(); let mut uploaded = Vec::new();
    for (i, bytes) in decoded.into_iter().enumerate() {
        progress(&app, &format!("Uploading screenshot {} of {}…", i + 1, count));
        let url = upload(&token, bytes, i).await?;
        uploaded.push((images[i]["id"].as_str().unwrap_or_default().to_string(), url));
    }
    let description = compose_description(&session, &images, &image_references, &uploaded)?;
    let mut input = json!({"id": session_id, "teamId": team_id, "title": title, "description": description, "priority": priority});
    if !labels.is_empty() { input["labelIds"] = json!(labels); }
    for field in ["projectId", "assigneeId"] { if let Some(value) = session[field].as_str().filter(|s| !s.is_empty()) { input[field] = json!(id(value)?); } }
    storage.set_submission(&session_id, &workspace, "creating", None)?;
    progress(&app, "Creating the Linear issue…");
    let body = request(&token, "mutation($input:IssueCreateInput!) { issueCreate(input:$input) { success issue { id identifier url } } }", json!({"input": input})).await
        .map_err(|e| format!("{e} The outcome is unknown; Retry checks this same issue first."))?;
    if first_error(&body).is_some() { return Err(format!("{} Your draft is kept.", describe_error(&body))); }
    let created = &body["data"]["issueCreate"];
    if created["success"] != true || created["issue"]["id"].is_null() { return Err("Issue creation was not confirmed. Retry will check this session first.".into()); }
    complete(&app, &workspace, session, created["issue"].clone())
}

#[tauri::command]
pub fn open_issue(window: WebviewWindow, app: AppHandle, url: String) -> Result<(), String> {
    main_only(&window)?;
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid issue link.")?;
    if parsed.scheme() != "https" || parsed.host_str() != Some("linear.app") { return Err("Only Linear issue links can be opened.".into()); }
    app.opener().open_url(parsed.as_str(), None::<&str>).map_err(|_| "Could not open your browser.".into())
}
#[tauri::command]
pub fn open_linear_setup(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    main_only(&window)?;
    app.opener().open_url("https://linear.app/settings/api/applications/new", None::<&str>).map_err(|_| "Could not open your browser.".into())
}

/// Creator and project pages shown in Settings → About. Only these fixed destinations can be opened.
pub fn about_url(target: &str) -> Option<&'static str> {
    match target {
        "github" => Some("https://github.com/Razee4315"),
        "linkedin" => Some("https://www.linkedin.com/in/saqlainrazee/"),
        "repository" => Some("https://github.com/Razee4315/snipflag"),
        "license" => Some("https://github.com/Razee4315/snipflag/blob/main/LICENSE"),
        _ => None,
    }
}
#[tauri::command]
pub fn open_about_link(window: WebviewWindow, app: AppHandle, target: String) -> Result<(), String> {
    main_only(&window)?;
    let url = about_url(&target).ok_or("Unknown link.")?;
    app.opener().open_url(url, None::<&str>).map_err(|_| "Could not open your browser.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn about_links_are_a_fixed_allowlist() {
        assert_eq!(about_url("github"), Some("https://github.com/Razee4315"));
        assert_eq!(about_url("linkedin"), Some("https://www.linkedin.com/in/saqlainrazee/"));
        assert!(about_url("https://evil.example").is_none());
    }
    #[test] fn captions_cannot_inject_markdown_images() { assert_eq!(markdown_caption("a\n![x](y)"), "a \\!\\[x\\](y)"); }
    #[test] fn description_keeps_filmstrip_order() {
        let text = build_description("Steps", &[("Login".into(), "https://uploads.linear.app/1".into()), ("".into(), "https://uploads.linear.app/2".into())]);
        let first = text.find("uploads.linear.app/1").unwrap(); let second = text.find("uploads.linear.app/2").unwrap();
        assert!(first < second);
        assert!(text.starts_with("Steps\n\n### 1. Login"));
        assert!(text.contains("### 2. Screenshot 2"));
    }
    #[test] fn composed_description_matches_the_shared_preview_fixtures() {
        let cases: Value = serde_json::from_str(include_str!("../../src/report.fixtures.json")).unwrap();
        for case in cases.as_array().unwrap() {
            let session = &case["session"];
            let images = session["images"].as_array().unwrap().clone();
            let refs = crate::mentions::references(session, &images).unwrap();
            crate::mentions::validate(session["description"].as_str().unwrap_or(""), &refs, &images).unwrap();
            let uploaded: Vec<(String, String)> = images.iter().map(|i| { let id = i["id"].as_str().unwrap().to_string(); let url = case["urls"][&id].as_str().unwrap().to_string(); (id, url) }).collect();
            assert_eq!(compose_description(session, &images, &refs, &uploaded).unwrap(), case["expected"].as_str().unwrap(), "{}", case["name"]);
        }
    }
    #[test] fn submission_plans_never_duplicate() {
        assert_eq!(plan(None, "w"), Plan::Fresh);
        assert_eq!(plan(Some(("w", "uploading", None)), "w"), Plan::Fresh);
        assert_eq!(plan(Some(("w", "creating", None)), "w"), Plan::Reconcile);
        assert_eq!(plan(Some(("w", "sent", Some("{}"))), "w"), Plan::Receipt("{}".into()));
        assert_eq!(plan(Some(("other", "creating", None)), "w"), Plan::WrongWorkspace);
    }
    #[test] fn not_found_is_distinguished_from_other_errors() {
        assert!(is_not_found(&json!({"errors":[{"message":"Entity not found: Issue"}]})));
        assert!(!is_not_found(&json!({"errors":[{"message":"Rate limited"}]})));
        assert!(describe_error(&json!({"errors":[{"message":"x","extensions":{"userPresentableMessage":"Title is required"}}]})).contains("Title is required"));
    }
}
