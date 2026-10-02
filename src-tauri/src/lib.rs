mod auth;
mod capture;
mod files;
mod linear;
mod mentions;
mod storage;
mod update;

use serde_json::{json, Value};
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
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
#[derive(Default)]
struct QuitState { pending: Mutex<Option<String>>, allowed: AtomicBool }

fn request_quit(app: &AppHandle) {
    show_main(app);
    let state = app.state::<QuitState>();
    let Ok(mut pending) = state.pending.lock() else { return };
    if pending.is_some() { return; }
    let request = uuid::Uuid::new_v4().to_string();
    *pending = Some(request.clone());
    if app.emit_to("main", "quit-requested", &request).is_err() { pending.take(); return; }
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        // A missing renderer acknowledgment must never force an unsafe exit. Allow another attempt.
        if let Ok(mut pending) = handle.state::<QuitState>().pending.lock() {
            if pending.as_deref() == Some(&request) { pending.take(); }
        };
    });
}
/// Lets an exit the app started itself (after a saved quit or a verified update) go through.
pub(crate) fn allow_exit(app: &AppHandle) { app.state::<QuitState>().allowed.store(true, Ordering::SeqCst); }
#[tauri::command]
fn finish_quit(window: WebviewWindow, app: AppHandle, request_id: String, saved: bool) -> Result<(), String> {
    main_only(&window)?;
    let state = app.state::<QuitState>();
    let mut pending = state.pending.lock().map_err(|_| "Quit state unavailable.")?;
    if pending.as_deref() != Some(&request_id) { return Err("Quit request expired. Try Quit again.".into()); }
    pending.take(); drop(pending);
    if saved { state.allowed.store(true, Ordering::SeqCst); app.exit(0); }
    Ok(())
}

pub fn show_main(app: &AppHandle) {
    REVEALED.store(true, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") { let _ = window.unminimize(); let _ = window.show(); let _ = window.set_focus(); }
}
fn request_capture(app: &AppHandle, tray: bool) {
    capture::requested(app, tray);
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
    if let Err(error) = storage.write_settings(&next) {
        // Nothing was saved: put the running shortcut and the login item back so they match the stored settings.
        if next["shortcut"] != previous["shortcut"] { set_shortcut_status(&app, register_shortcut(&app, previous["shortcut"].as_str().unwrap_or_default()).err()); }
        if next["launchAtLogin"] != previous["launchAtLogin"] {
            let autolaunch = app.autolaunch();
            let _ = if previous["launchAtLogin"] == true { autolaunch.enable() } else { autolaunch.disable() };
        }
        return Err(error);
    }
    if next["retentionDays"] != previous["retentionDays"] { storage.record_cleanup(storage.prune(next["retentionDays"].as_u64().unwrap_or(0)))?; }
    Ok(next)
}
#[tauri::command]
fn app_status(window: WebviewWindow, app: AppHandle) -> Result<Value, String> {
    main_only(&window)?;
    let shortcut_error = app.state::<ShortcutStatus>().0.lock().ok().and_then(|s| s.clone());
    let cleanup_error = app.state::<Storage>().cleanup_error.lock().ok().and_then(|s| s.clone());
    Ok(json!({"version": app.package_info().version.to_string(), "platform": std::env::consts::OS, "shortcutError": shortcut_error, "cleanupError": cleanup_error, "builtinLinearClient": !auth::builtin_client_id().is_empty(), "updates": !update::pubkey().is_empty(), "tray": TRAY.load(Ordering::SeqCst)}))
}

/// Comfortable full workspace in logical pixels: large, never fullscreen, always inside the work area.
fn workspace_size(available: (f64, f64)) -> (f64, f64) {
    let width = (available.0 * 0.84).clamp(960.0, 1440.0).min(available.0 - 24.0).max(640.0);
    let height = (available.1 * 0.88).clamp(640.0, 920.0).min(available.1 - 24.0).max(480.0);
    (width, height)
}

/// Room the editor chrome needs around a screenshot shown at 100% (composer column, toolbar, image bar, filmstrip).
const CHROME: (f64, f64) = (400.0, 250.0);
/// Whether a screenshot of `image` physical pixels cannot be shown at 100% inside the normal workspace.
fn needs_full_screen(image: (u32, u32), scale: f64, available: (f64, f64)) -> bool {
    let (width, height) = workspace_size(available);
    image.0 as f64 / scale + CHROME.0 > width || image.1 as f64 / scale + CHROME.1 > height
}
/// Grows the editor for a screenshot: maximized when it cannot fit the workspace at 100%, otherwise the workspace.
pub fn fit_image(window: &WebviewWindow, image: (u32, u32)) -> tauri::Result<()> {
    if let Some(monitor) = window.current_monitor()? {
        let scale = monitor.scale_factor();
        let logical = monitor.work_area().size.to_logical::<f64>(scale);
        if needs_full_screen(image, scale, (logical.width, logical.height)) { return window.maximize(); }
    }
    fit_workspace(window, false)
}

/// Sizes and centers the editor on its display. Without `force`, only grows a window smaller than the workspace
/// and leaves maximized windows alone, so a larger size the user chose is kept.
pub fn fit_workspace(window: &WebviewWindow, force: bool) -> tauri::Result<()> {
    if !force && window.is_maximized().unwrap_or(false) { return Ok(()); }
    let monitor = match window.current_monitor()? { Some(m) => Some(m), None => window.primary_monitor()? };
    let Some(monitor) = monitor else { return window.center(); };
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let logical = area.size.to_logical::<f64>(scale);
    let (width, height) = workspace_size((logical.width, logical.height));
    if !force {
        let current = window.inner_size()?.to_logical::<f64>(window.scale_factor()?);
        if current.width + 1.0 >= width && current.height + 1.0 >= height { return Ok(()); }
    }
    window.unmaximize()?;
    window.set_size(tauri::LogicalSize::new(width, height))?;
    // Physical work-area origin preserves negative-origin displays and excludes taskbars.
    window.set_position(tauri::PhysicalPosition::new(
        area.position.x + ((area.size.width as f64 - width * scale) / 2.0).max(0.0) as i32,
        area.position.y + ((area.size.height as f64 - height * scale) / 2.0).max(0.0) as i32,
    ))
}

/// The editor stays hidden until its first paint so it never flashes an empty frame.
static REVEALED: AtomicBool = AtomicBool::new(false);
static STARTED_MINIMIZED: AtomicBool = AtomicBool::new(false);
/// Whether the tray icon exists. Without it a hidden editor could not be opened again.
static TRAY: AtomicBool = AtomicBool::new(false);
fn reveal(app: &AppHandle) {
    let stay_hidden = STARTED_MINIMIZED.load(Ordering::SeqCst) && TRAY.load(Ordering::SeqCst);
    if !REVEALED.swap(true, Ordering::SeqCst) && !stay_hidden { show_main(app); }
}
/// Puts the editor away: into the tray, or minimized when this desktop has no tray to bring it back from.
fn tuck_away(window: &WebviewWindow) -> tauri::Result<()> {
    if TRAY.load(Ordering::SeqCst) { window.hide() } else { window.minimize() }
}

/// Only the main editor may move or hide itself. Capture overlays have no access.
#[tauri::command]
fn editor_window(window: WebviewWindow, app: AppHandle, action: String, image_width: Option<u32>, image_height: Option<u32>) -> Result<(), String> {
    main_only(&window)?;
    let result = match action.as_str() {
        "hide" => tuck_away(&window),
        "minimize" => window.minimize(),
        // Toggles between maximized and the previous size.
        "maximize" => if window.is_maximized().unwrap_or(false) { window.unmaximize() } else { window.maximize() },
        "drag" => window.start_dragging(),
        "workspace" => match (image_width, image_height) {
            (Some(width), Some(height)) => fit_image(&window, (width, height)),
            _ => fit_workspace(&window, false),
        },
        "reveal" => { reveal(&app); Ok(()) }
        // Brings the editor forward from the tray when it has something to tell the user.
        "show" => { show_main(&app); Ok(()) }
        _ => return Err("Unknown editor window action.".into()),
    };
    result.map_err(|_| "Could not update the editor window.".into())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let capture = MenuItem::with_id(app, "capture", "Capture screenshot", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Open Snipflag", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Snipflag", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&capture, &show, &separator, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main").tooltip("Snipflag").menu(&menu).show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "capture" => request_capture(app, true),
            "show" => show_main(app),
            "quit" => request_quit(app),
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
            if event.state == ShortcutState::Pressed { request_capture(app, false); }
        }).build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .register_asynchronous_uri_scheme_protocol("snipframe", capture::frame_protocol)
        .manage(update::PendingUpdate(tokio::sync::Mutex::new(None)))
        .manage(auth::NetworkLock(tokio::sync::Mutex::new(())))
        .manage(auth::TokenLock(tokio::sync::Mutex::new(())))
        .manage(auth::LoginCancel(Mutex::new(None)))
        .manage(capture::CaptureState::default())
        .manage(files::ClipboardState(Mutex::new(None)))
        .manage(ShortcutStatus(Mutex::new(None)))
        .manage(QuitState::default())
        .setup(|app| {
            let storage = Storage::open(app.handle())?;
            let settings = storage.settings()?;
            let _ = storage.record_cleanup(storage.prune(settings["retentionDays"].as_u64().unwrap_or(30)));
            app.manage(storage);
            let status = register_shortcut(app.handle(), settings["shortcut"].as_str().unwrap_or_default()).err();
            set_shortcut_status(app.handle(), status);
            TRAY.store(build_tray(app.handle()).is_ok(), Ordering::SeqCst);
            let minimized = std::env::args().any(|a| a == "--minimized");
            STARTED_MINIMIZED.store(minimized, Ordering::SeqCst);
            if let Some(main) = app.get_webview_window("main") { let _ = fit_workspace(&main, true); }
            // The editor reveals itself after its first paint; never leave the user without a window.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(4)).await;
                reveal(&handle);
            });
            // Capture overlays are opened hidden once the editor has had time to start.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                capture::prewarm(&handle);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    // Closing the editor keeps Snipflag in the tray; Quit is in the tray menu.
                    api.prevent_close();
                    if let Some(main) = window.app_handle().get_webview_window("main") { let _ = tuck_away(&main); }
                } else if window.label().starts_with("capture-") {
                    api.prevent_close();
                    capture::cancel(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            storage::save_session, storage::load_session, storage::list_sessions, storage::delete_session,
            storage::clear_history, storage::load_settings, storage::submission_status,
            save_settings, app_status, editor_window, finish_quit,
            auth::connect_linear, auth::cancel_login, auth::disconnect_linear,
            linear::linear_connection, linear::linear_team_options, linear::submit_issue, linear::reconcile_issue, linear::open_issue, linear::open_linear_setup, linear::open_about_link,
            capture::start_capture, capture::capture_state, capture::capture_ready, capture::capture_timing, capture::capture_select, capture::capture_cancel,
            files::export_png, files::share_images, files::read_clipboard_image, files::copy_text,
            update::check_update, update::install_update,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Snipflag");
    app.run(|app, event| match event {
        RunEvent::ExitRequested { api, .. } => {
            if !app.state::<QuitState>().allowed.load(Ordering::SeqCst) { api.prevent_exit(); request_quit(app); }
        }
        RunEvent::Exit => {
            // arboard must be dropped before the process exits.
            if let Ok(mut clipboard) = app.state::<files::ClipboardState>().0.lock() { clipboard.take(); }
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => show_main(app),
        _ => {}
    });
}

#[cfg(test)]
mod editor_window_tests {
    use super::{needs_full_screen, workspace_size};
    #[test]
    fn workspace_is_large_on_common_displays() {
        let (width, height) = workspace_size((1920.0, 1040.0));
        assert!(width >= 1400.0 && height >= 880.0);
        assert!(width <= 1896.0 && height <= 1016.0);
    }
    #[test]
    fn only_screenshots_too_large_for_the_workspace_go_full_screen() {
        assert!(!needs_full_screen((800, 500), 1.0, (1920.0, 1040.0)));
        assert!(needs_full_screen((1920, 1080), 1.0, (1920.0, 1040.0)));
        // A full 4K monitor at 200% is 1920 x 1080 logical pixels: too large for the workspace.
        assert!(needs_full_screen((3840, 2160), 2.0, (1920.0, 1040.0)));
        assert!(!needs_full_screen((1600, 1000), 2.0, (1920.0, 1040.0)));
    }
    #[test]
    fn workspace_stays_inside_small_work_areas() {
        let (width, height) = workspace_size((960.0, 520.0));
        assert!(width < 960.0 && height < 520.0);
        assert!(width >= 640.0 && height >= 480.0);
    }
}
