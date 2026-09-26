use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, sync::oneshot};
use crate::storage::{main_only, now, Storage};

pub const SERVICE: &str = "io.github.razee4315.snipflag";
const REDIRECT: &str = "http://127.0.0.1:47839/callback";

pub fn builtin_client_id() -> &'static str { option_env!("SNIPFLAG_LINEAR_CLIENT_ID").unwrap_or("").trim() }
fn resolve_client_id<'a>(custom: &'a str, builtin: &'a str) -> Result<&'a str, String> {
    let id = if custom.trim().is_empty() { builtin.trim() } else { custom.trim() };
    if id.is_empty() { return Err("This build has no built-in Linear connection. Add a public client ID in Settings → Advanced, or use a configured installer.".into()); }
    Ok(id)
}

/// Serializes Linear operations so refresh-token rotation and keyring writes never race.
pub struct NetworkLock(pub tokio::sync::Mutex<()>);
/// Lets the editor abandon a browser login that the user closed.
pub struct LoginCancel(pub Mutex<Option<oneshot::Sender<()>>>);

#[derive(Serialize, Deserialize)]
struct Credential { access_token: String, #[serde(default)] refresh_token: String, expires_at: u64, client_id: String }

fn entry() -> Result<keyring::Entry, String> { keyring::Entry::new(SERVICE, "linear-oauth").map_err(|_| "Credential store is unavailable. Unlock your system keyring and retry.".into()) }
fn read() -> Result<Option<Credential>, String> {
    match entry()?.get_password() {
        Ok(raw) => serde_json::from_str(&raw).map(Some).map_err(|_| "Saved connection is invalid. Reconnect Linear.".into()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Credential store is unavailable. Unlock your system keyring and retry.".into()),
    }
}
pub fn is_connected() -> Result<bool, String> { Ok(read()?.is_some()) }
fn store(value: &Value, client_id: &str, previous_refresh: &str) -> Result<Credential, String> {
    let credential = Credential {
        access_token: value["access_token"].as_str().filter(|s| !s.is_empty()).ok_or("Linear did not return an access token.")?.into(),
        // Refresh tokens rotate; keep the previous one only if Linear did not send a replacement.
        refresh_token: value["refresh_token"].as_str().unwrap_or(previous_refresh).into(),
        expires_at: now() + value["expires_in"].as_u64().unwrap_or(86_400) * 1000,
        client_id: client_id.into(),
    };
    let raw = serde_json::to_string(&credential).map_err(|_| "Cannot save connection.")?;
    entry()?.set_password(&raw).map_err(|_| "Could not securely store the connection. Unlock your system credential store.")?;
    Ok(credential)
}
pub fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(60)).connect_timeout(Duration::from_secs(15)).redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("Snipflag/", env!("CARGO_PKG_VERSION"))).build().map_err(|_| "Cannot initialize network client.".into())
}
async fn token_request(fields: &[(&str, &str)]) -> Result<Value, String> {
    let response = client()?.post("https://api.linear.app/oauth/token").form(fields).send().await.map_err(|_| "Could not reach Linear. Check your connection and retry.")?;
    if !response.status().is_success() { return Err("Linear could not authorize this connection. Check the client ID and registered callback, then reconnect.".into()); }
    response.json().await.map_err(|_| "Invalid authorization response.".into())
}
/// Call only while NetworkLock is held.
pub async fn access_token() -> Result<String, String> {
    let saved = read()?.ok_or("Connect Linear in Settings to continue.")?;
    if saved.expires_at > now() + 90_000 { return Ok(saved.access_token); }
    if saved.refresh_token.is_empty() { return Err("Your Linear connection has expired. Reconnect in Settings.".into()); }
    let value = token_request(&[("grant_type", "refresh_token"), ("refresh_token", &saved.refresh_token), ("client_id", &saved.client_id)]).await
        .map_err(|_| "Your Linear connection could not be renewed. Reconnect in Settings.".to_string())?;
    Ok(store(&value, &saved.client_id, &saved.refresh_token)?.access_token)
}
pub fn forget() -> Result<(), String> {
    match entry()?.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(_) => Err("Could not remove the saved credential.".into()) }
}
fn pkce() -> (String, String) {
    let verifier = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}
/// Parses the request line of a loopback callback. Returns the code only for a matching state.
fn parse_callback(request: &str, state: &str) -> Option<Result<String, String>> {
    let path = request.lines().next()?.strip_prefix("GET ")?.split_whitespace().next()?;
    let callback = url::Url::parse(&format!("http://127.0.0.1:47839{path}")).ok()?;
    if callback.path() != "/callback" { return None; }
    let query: HashMap<_, _> = callback.query_pairs().into_owned().collect();
    if query.get("state").map(String::as_str) != Some(state) { return None; }
    Some(query.get("code").filter(|c| !c.is_empty() && c.len() < 2048).cloned().ok_or_else(|| "Linear login was cancelled or denied.".to_string()))
}
async fn wait_for_code(listener: tokio::net::TcpListener, state: String) -> Result<String, String> {
    loop {
        let (mut socket, _) = listener.accept().await.map_err(|_| "Login callback failed.")?;
        let mut buffer = vec![0u8; 8192];
        let n = match tokio::time::timeout(Duration::from_secs(3), socket.read(&mut buffer)).await { Ok(Ok(n)) => n, _ => continue };
        let request = String::from_utf8_lossy(&buffer[..n]).into_owned();
        let outcome = parse_callback(&request, &state);
        let body = match &outcome { Some(Ok(_)) => "Authorization received. Return to Snipflag to finish connecting. You can close this tab.", Some(Err(_)) => "Linear login was cancelled. You can close this tab.", None => "This login response was not accepted. Return to Snipflag and retry." };
        let status = if outcome.is_some() { "200 OK" } else { "400 Bad Request" };
        let reply = format!("HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
        let _ = socket.write_all(reply.as_bytes()).await;
        if let Some(outcome) = outcome { return outcome; }
    }
}

#[tauri::command]
pub async fn connect_linear(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    main_only(&window)?;
    let lock = app.state::<NetworkLock>();
    let _guard = lock.0.try_lock().map_err(|_| "Another Linear operation is in progress.")?;
    let settings = app.state::<Storage>().settings()?;
    let client_id = resolve_client_id(settings["clientId"].as_str().unwrap_or(""), builtin_client_id())?.to_string();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:47839").await.map_err(|_| "Login callback port 47839 is in use. Close the other login attempt and retry.")?;
    let (verifier, challenge) = pkce();
    let state = uuid::Uuid::new_v4().to_string();
    let mut url = url::Url::parse("https://linear.app/oauth/authorize").map_err(|_| "Invalid login endpoint.")?;
    url.query_pairs_mut().extend_pairs([("client_id", client_id.as_str()), ("redirect_uri", REDIRECT), ("response_type", "code"), ("scope", "read,write"), ("state", state.as_str()), ("code_challenge", challenge.as_str()), ("code_challenge_method", "S256"), ("actor", "user"), ("prompt", "consent")]);
    let (cancel_tx, cancel_rx) = oneshot::channel();
    *app.state::<LoginCancel>().0.lock().map_err(|_| "Login state unavailable.")? = Some(cancel_tx);
    app.opener().open_url(url.as_str(), None::<&str>).map_err(|_| "Could not open your browser.")?;
    let result = tokio::select! {
        r = tokio::time::timeout(Duration::from_secs(300), wait_for_code(listener, state)) => r.map_err(|_| "Login timed out. Choose Connect Linear to try again.".to_string()).and_then(|r| r),
        _ = cancel_rx => Err("Login cancelled.".to_string()),
    };
    if let Ok(mut pending) = app.state::<LoginCancel>().0.lock() { pending.take(); }
    let code = result?;
    let value = token_request(&[("grant_type", "authorization_code"), ("client_id", &client_id), ("redirect_uri", REDIRECT), ("code", &code), ("code_verifier", &verifier)]).await?;
    store(&value, &client_id, "")?;
    crate::show_main(&app);
    Ok(())
}
#[tauri::command]
pub fn cancel_login(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    main_only(&window)?;
    if let Some(sender) = app.state::<LoginCancel>().0.lock().map_err(|_| "Login state unavailable.")?.take() { let _ = sender.send(()); }
    Ok(())
}
#[tauri::command]
pub async fn disconnect_linear(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    main_only(&window)?;
    let lock = app.state::<NetworkLock>();
    let _guard = lock.0.try_lock().map_err(|_| "Wait for the current Linear operation to finish.")?;
    forget()?;
    // Disconnecting also clears remembered workspace selections.
    let storage = app.state::<Storage>();
    let mut settings = storage.settings()?; settings["teamMemory"] = serde_json::json!({});
    storage.write_settings(&settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn client_selection_preserves_overrides_and_upgrades_empty_settings() {
        assert_eq!(resolve_client_id("", "official-v2").unwrap(), "official-v2");
        assert_eq!(resolve_client_id("custom", "official-v2").unwrap(), "custom");
        assert_eq!(resolve_client_id("custom", "").unwrap(), "custom");
        assert!(resolve_client_id(" ", "").is_err());
        assert_eq!(crate::storage::normalize_settings(&serde_json::json!({"clientId":""})).unwrap()["clientId"], "");
    }
    #[test] fn pkce_challenge_is_s256_of_verifier() {
        let (verifier, challenge) = pkce();
        assert!(verifier.len() >= 43);
        assert_eq!(challenge, URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes())));
    }
    #[test] fn callback_requires_matching_state() {
        assert_eq!(parse_callback("GET /callback?code=abc&state=s1 HTTP/1.1\r\n", "s1"), Some(Ok("abc".into())));
        assert_eq!(parse_callback("GET /callback?code=abc&state=evil HTTP/1.1\r\n", "s1"), None);
        assert_eq!(parse_callback("GET /other?code=abc&state=s1 HTTP/1.1\r\n", "s1"), None);
        assert!(matches!(parse_callback("GET /callback?error=access_denied&state=s1 HTTP/1.1\r\n", "s1"), Some(Err(_))));
    }
}
