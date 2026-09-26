use serde_json::{json, Value};
use std::{sync::{Arc, Mutex}, time::Duration};
use tokio::sync::OnceCell;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use xcap::{image::{imageops, RgbaImage}, Monitor};
use crate::storage::{encode_png, main_only, png_url, MAX_IMAGE_BYTES};

type Preview = Arc<OnceCell<Result<Value, String>>>;
pub struct Frame { x: i32, y: i32, width: u32, height: u32, image: Arc<RgbaImage>, preview: Preview }
/// `Some` while a capture is in progress; holds the frozen frame of every monitor.
pub struct CaptureState(pub Mutex<Option<Vec<Frame>>>);

fn unavailable() -> String {
    if cfg!(target_os = "macos") { "Snipflag cannot read the screen. Allow Screen Recording for Snipflag in System Settings → Privacy & Security, then retry.".into() }
    else if cfg!(target_os = "linux") { "Screen capture is not available in this desktop session. On Wayland, use Add images or Paste a screenshot instead.".into() }
    else { "Screen capture failed. Use Add images or Paste a screenshot instead.".into() }
}
fn grab() -> Result<Vec<Frame>, String> {
    let monitors = Monitor::all().map_err(|_| unavailable())?;
    if monitors.is_empty() { return Err(unavailable()); }
    let mut frames = Vec::new();
    for monitor in monitors {
        let image = monitor.capture_image().map_err(|_| unavailable())?;
        if image.width() < 2 || image.height() < 2 { continue; }
        frames.push(Frame { x: monitor.x().unwrap_or(0), y: monitor.y().unwrap_or(0), width: monitor.width().unwrap_or(image.width()), height: monitor.height().unwrap_or(image.height()), image: Arc::new(image), preview: Arc::default() });
    }
    if frames.is_empty() { return Err(unavailable()); }
    Ok(frames)
}
fn capture_index(window: &WebviewWindow) -> Result<usize, String> {
    window.label().strip_prefix("capture-").and_then(|i| i.parse().ok()).ok_or_else(|| "This action is only available while capturing.".into())
}
/// Encodes a monitor's frozen frame for its overlay once. Started for every monitor right after the grab,
/// so encoding runs in parallel with overlay creation instead of after each overlay asks for it.
async fn preview(image: Arc<RgbaImage>, cell: Preview) -> Result<Value, String> {
    cell.get_or_init(|| async move {
        let (width, height) = (image.width(), image.height());
        match tauri::async_runtime::spawn_blocking(move || encode_png(&image, true)).await {
            Ok(Ok(bytes)) => Ok(json!({"dataUrl": png_url(&bytes), "width": width, "height": height})),
            Ok(Err(e)) => Err(e),
            Err(_) => Err("Could not prepare the capture.".to_string()),
        }
    }).await.clone()
}
/// Closes every overlay, forgets frozen frames, and restores the editor.
fn finish(app: &AppHandle) {
    if let Ok(mut state) = app.state::<CaptureState>().0.lock() { state.take(); }
    for (label, window) in app.webview_windows() { if label.starts_with("capture-") { let _ = window.destroy(); } }
    // A capture always returns to the full workspace; a larger size the user chose is kept.
    if let Some(main) = app.get_webview_window("main") { let _ = crate::fit_workspace(&main, false); }
    crate::show_main(app);
}
pub fn cancel(app: &AppHandle) {
    let active = app.state::<CaptureState>().0.lock().map(|s| s.is_some()).unwrap_or(false);
    if active { finish(app); let _ = app.emit_to("main", "capture-cancelled", ()); }
}
/// Crops a selection given in frame pixels. Selections are clamped to the monitor.
pub fn crop(image: &RgbaImage, x: f64, y: f64, width: f64, height: f64) -> Option<RgbaImage> {
    if ![x, y, width, height].iter().all(|v| v.is_finite()) { return None; }
    let left = x.max(0.0).floor() as u32; let top = y.max(0.0).floor() as u32;
    let right = ((x + width).ceil().max(0.0) as u32).min(image.width()); let bottom = ((y + height).ceil().max(0.0) as u32).min(image.height());
    if right <= left + 1 || bottom <= top + 1 { return None; }
    Some(imageops::crop_imm(image, left, top, right - left, bottom - top).to_image())
}

pub async fn begin(app: AppHandle) -> Result<(), String> {
    {
        let state = app.state::<CaptureState>();
        let mut guard = state.0.lock().map_err(|_| "Capture is unavailable.")?;
        if guard.is_some() { return Err("A capture is already in progress.".into()); }
        *guard = Some(Vec::new());
    }
    let main = app.get_webview_window("main");
    let was_visible = main.as_ref().and_then(|w| w.is_visible().ok()).unwrap_or(false);
    if let Some(w) = &main { let _ = w.hide(); }
    // Give the compositor time to remove the editor before the frame is frozen.
    tokio::time::sleep(Duration::from_millis(if was_visible { 300 } else { 60 })).await;
    let frames = match tauri::async_runtime::spawn_blocking(grab).await {
        Ok(Ok(frames)) => frames,
        Ok(Err(e)) => { finish(&app); return Err(e); }
        Err(_) => { finish(&app); return Err("Capture stopped unexpectedly.".into()); }
    };
    let geometry: Vec<(i32, i32, u32, u32)> = frames.iter().map(|f| (f.x, f.y, f.width, f.height)).collect();
    for frame in &frames { tauri::async_runtime::spawn(preview(frame.image.clone(), frame.preview.clone())); }
    if let Ok(mut state) = app.state::<CaptureState>().0.lock() { *state = Some(frames); }
    for (index, (x, y, width, height)) in geometry.into_iter().enumerate() {
        let built = WebviewWindowBuilder::new(&app, format!("capture-{index}"), WebviewUrl::App(format!("index.html?capture={index}").into()))
            .title("Snipflag capture").decorations(false).resizable(false).skip_taskbar(true).always_on_top(true).shadow(false).visible(false).focused(true)
            .build();
        let window = match built { Ok(w) => w, Err(_) => { finish(&app); return Err("Could not open the capture overlay.".into()); } };
        // macOS reports monitor bounds in points; other platforms report physical pixels.
        #[cfg(target_os = "macos")]
        { let _ = window.set_position(tauri::LogicalPosition::new(x as f64, y as f64)); let _ = window.set_size(tauri::LogicalSize::new(width as f64, height as f64)); }
        #[cfg(not(target_os = "macos"))]
        { let _ = window.set_position(tauri::PhysicalPosition::new(x, y)); let _ = window.set_size(tauri::PhysicalSize::new(width, height)); }
    }
    // Overlays show themselves once the frozen frame is painted. Never leave the user without a visible window.
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(3)).await;
        for (label, window) in handle.webview_windows() { if label.starts_with("capture-") && !window.is_visible().unwrap_or(true) { let _ = window.show(); let _ = window.set_focus(); } }
    });
    Ok(())
}

#[tauri::command]
pub async fn start_capture(window: WebviewWindow, app: AppHandle) -> Result<(), String> { main_only(&window)?; begin(app).await }
#[tauri::command]
pub async fn capture_frame(window: WebviewWindow, app: AppHandle) -> Result<Value, String> {
    let index = capture_index(&window)?;
    let (image, cell) = {
        let state = app.state::<CaptureState>(); let guard = state.0.lock().map_err(|_| "Capture is unavailable.")?;
        guard.as_ref().and_then(|frames| frames.get(index)).map(|f| (f.image.clone(), f.preview.clone())).ok_or("This capture has ended.")?
    };
    preview(image, cell).await
}
#[tauri::command]
pub fn capture_ready(window: WebviewWindow) -> Result<(), String> {
    capture_index(&window)?;
    let _ = window.show(); let _ = window.set_focus();
    Ok(())
}
#[tauri::command]
pub async fn capture_select(window: WebviewWindow, app: AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    let index = capture_index(&window)?;
    let frame = {
        let state = app.state::<CaptureState>(); let mut guard = state.0.lock().map_err(|_| "Capture is unavailable.")?;
        let mut frames = guard.take().ok_or("This capture has ended.")?;
        if index >= frames.len() { return Err("This capture has ended.".into()); }
        frames.swap_remove(index).image
    };
    finish(&app);
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let cropped = crop(&frame, x, y, width, height).ok_or("Select a larger area.")?;
        let bytes = encode_png(&cropped, false)?;
        if bytes.len() > MAX_IMAGE_BYTES { return Err("The captured area exceeds 20 MB. Select a smaller area.".to_string()); }
        Ok(json!({"dataUrl": png_url(&bytes), "width": cropped.width(), "height": cropped.height()}))
    }).await.map_err(|_| "Could not finish the capture.".to_string()).and_then(|r| r);
    match result {
        Ok(payload) => { let _ = app.emit_to("main", "capture-complete", payload); }
        Err(message) => { let _ = app.emit_to("main", "capture-failed", message); }
    }
    Ok(())
}
#[tauri::command]
pub fn capture_cancel(window: WebviewWindow, app: AppHandle) -> Result<(), String> { capture_index(&window)?; cancel(&app); Ok(()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn crop_clamps_to_frame_and_rejects_tiny_areas() {
        let image = RgbaImage::new(100, 50);
        assert_eq!(crop(&image, 10.2, 5.0, 20.0, 10.0).map(|c| c.dimensions()), Some((21, 10)));
        assert_eq!(crop(&image, -20.0, -20.0, 1000.0, 1000.0).map(|c| c.dimensions()), Some((100, 50)));
        assert!(crop(&image, 10.0, 10.0, 0.5, 30.0).is_none());
        assert!(crop(&image, f64::NAN, 0.0, 10.0, 10.0).is_none());
        assert!(crop(&image, 200.0, 0.0, 10.0, 10.0).is_none());
    }
}
