mod auth;
mod capture;
mod files;
mod linear;
mod storage;

use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, State, WebviewWindow, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use storage::{main_only, Storage};

/// Last global shortcut registration problem, shown in the editor instead of failing silently.
struct ShortcutStatus(Mutex<Option<String>>);

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") { let _ = window.unminimize(); let _ = window.show(); let _ = window.set_focus(); }
}
fn request_capture(app: &AppHandle) {
    // The editor saves its draft first, then calls start_capture.
    let _ = app.emit_to("main", "capture-requested", ());
}
fn register_shortcut(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let parsed: Shortcut = shortcut.parse().map_err(|_| format!("“{shortcut}” is not a valid shortcut."))?;
    let manager = app.global_shortcut();
    let _ = manager.unregister_all();
    manager.register(parsed).map_err(|_| format!("{} is already used by another app. Choose a different capture shortcut in Settings.", shortcut.replace("CommandOrControl", if cfg!(target_os = "macos") { "Cmd" } else { "Ctrl" })))
}
fn set_shortcut_status(app: &AppHandle, status: Option<String>) {
    if let Ok(mut s) = app.state::<ShortcutStatus>().0.lock() { *s = status; }
}

#[tauri::command]
fn save_settings(window: WebviewWindow, app: AppHandle, storage: State<Storage>, settings: Value) -> Result<Value, String> {
    main_only(&window)?;
    let next = storage::normalize_settings(&settings)?;
    let previous = storage.settings()?;
    if next["shortcut"] != previous["shortcut"] {
        if let Err(error) = register_shortcut(&app, next["shortcut"].as_str().unwrap_or_default()) {
            let restored = register_shortcut(&app, previous["shortcut"].as_str().unwrap_or_default());
            set_shortcut_status(&app, restored.err());
            return Err(error);
        }
        set_shortcut_status(&app, None);
    }
    if next["launchAtLogin"] != previous["launchAtLogin"] {
        let autolaunch = app.autolaunch();
        let result = if next["launchAtLogin"] == true { autolaunch.enable() } else { autolaunch.disable() };
        result.map_err(|_| "Could not change the launch at login setting.")?;
    }
    storage.write_settings(&next)?;
    if next["retentionDays"] != previous["retentionDays"] { let _ = storage.prune(next["retentionDays"].as_u64().unwrap_or(0)); }
    Ok(next)
}
#[tauri::command]
fn app_status(window: WebviewWindow, app: AppHandle) -> Result<Value, String> {
    main_only(&window)?;
    let shortcut_error = app.state::<ShortcutStatus>().0.lock().ok().and_then(|s| s.clone());
    Ok(json!({"version": app.package_info().version.to_string(), "platform": std::env::consts::OS, "shortcutError": shortcut_error}))
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let capture = MenuItem::with_id(app, "capture", "Capture screenshot", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Open Snipflag", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Snipflag", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&capture, &show, &separator, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main").tooltip("Snipflag").menu(&menu).show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "capture" => request_capture(app),
            "show" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event { show_main(tray.app_handle()); }
        });
    if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Must be registered first so a second launch focuses the existing editor.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(|app, _shortcut, event| {
            if event.state == ShortcutState::Pressed { request_capture(app); }
        }).build())
        .manage(auth::NetworkLock(tokio::sync::Mutex::new(())))
        .manage(auth::LoginCancel(Mutex::new(None)))
        .manage(capture::CaptureState(Mutex::new(None)))
        .manage(files::ClipboardState(Mutex::new(None)))
        .manage(ShortcutStatus(Mutex::new(None)))
        .setup(|app| {
            let storage = Storage::open(app.handle())?;
            let settings = storage.settings()?;
            let _ = storage.prune(settings["retentionDays"].as_u64().unwrap_or(30));
            app.manage(storage);
            let status = register_shortcut(app.handle(), settings["shortcut"].as_str().unwrap_or_default()).err();
            set_shortcut_status(app.handle(), status);
            if let Err(error) = build_tray(app.handle()) { eprintln!("tray unavailable: {error}"); }
            if !std::env::args().any(|a| a == "--minimized") { show_main(app.handle()); }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    // Closing the editor keeps Snipflag in the tray; Quit is in the tray menu.
                    api.prevent_close();
                    let _ = window.hide();
                } else if window.label().starts_with("capture-") {
                    api.prevent_close();
                    capture::cancel(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            storage::save_session, storage::load_session, storage::list_sessions, storage::delete_session,
            storage::clear_history, storage::load_settings, storage::submission_status,
            save_settings, app_status,
            auth::connect_linear, auth::cancel_login, auth::disconnect_linear,
            linear::linear_connection, linear::linear_team_options, linear::submit_issue, linear::open_issue, linear::open_linear_setup,
            capture::start_capture, capture::capture_frame, capture::capture_ready, capture::capture_select, capture::capture_cancel,
            files::export_png, files::read_clipboard_image, files::copy_text,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Snipflag");
    app.run(|app, event| match event {
        RunEvent::Exit => {
            // arboard must be dropped before the process exits.
            if let Ok(mut clipboard) = app.state::<files::ClipboardState>().0.lock() { clipboard.take(); }
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => show_main(app),
        _ => {}
    });
}
