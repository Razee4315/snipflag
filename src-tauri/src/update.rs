use std::time::Duration;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_updater::{Update, UpdaterExt};
use crate::storage::main_only;

/// The release marked Latest on GitHub publishes this manifest next to its installers.
pub const ENDPOINT: &str = "https://github.com/Razee4315/snipflag/releases/latest/download/latest.json";
/// Public key for update signatures, supplied at build time. Without it this build never offers updates.
pub fn pubkey() -> &'static str { option_env!("SNIPFLAG_UPDATER_PUBKEY").unwrap_or("").trim() }
/// The update found by the last check, waiting for the user's install request.
pub struct PendingUpdate(pub tokio::sync::Mutex<Option<Update>>);

fn updater(app: &AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    if pubkey().is_empty() { return Err("This build does not include automatic updates.".into()); }
    let endpoint = ENDPOINT.parse().map_err(|_| "Update address is invalid.")?;
    app.updater_builder().pubkey(pubkey()).timeout(Duration::from_secs(300)).endpoints(vec![endpoint])
        .and_then(|b| b.build()).map_err(|_| "Updates are unavailable in this build.".into())
}

/// Release notes are shown as plain text; keep them short.
pub fn summary(version: &str, notes: Option<&str>) -> Value {
    json!({"version": version, "notes": notes.unwrap_or("").chars().take(1000).collect::<String>()})
}

#[tauri::command]
pub async fn check_update(window: WebviewWindow, app: AppHandle) -> Result<Option<Value>, String> {
    main_only(&window)?;
    let update = updater(&app)?.check().await.map_err(|_| "Could not check for updates. Try again later.")?;
    let info = update.as_ref().map(|u| summary(&u.version, u.body.as_deref()));
    *app.state::<PendingUpdate>().0.lock().await = update;
    Ok(info)
}

/// The editor saves its draft first. The download is verified against the embedded key before installing.
#[tauri::command]
pub async fn install_update(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    main_only(&window)?;
    let lock = app.state::<crate::auth::NetworkLock>();
    let _guard = lock.0.try_lock().map_err(|_| "Wait for the current Linear operation to finish before updating.")?;
    let update = app.state::<PendingUpdate>().0.lock().await.take().ok_or("Check for updates again before installing.")?;
    update.download_and_install(|_, _| {}, || {}).await.map_err(|_| "The update could not be downloaded or verified. Snipflag was not changed.")?;
    crate::allow_exit(&app);
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn update_source_is_the_fixed_https_release_manifest() {
        let url = url::Url::parse(ENDPOINT).unwrap();
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.host_str(), Some("github.com"));
        assert!(url.path().starts_with("/Razee4315/snipflag/releases/latest/"));
    }
    #[test] fn release_notes_are_bounded() {
        let long = "x".repeat(5000);
        assert_eq!(summary("1.2.0", Some(&long))["notes"].as_str().unwrap().len(), 1000);
        assert_eq!(summary("1.2.0", None)["notes"], "");
    }
}
