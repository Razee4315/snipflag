use serde_json::{json, Value};
use std::{sync::{atomic::{AtomicU64, Ordering}, Arc, Mutex}, time::{Duration, Instant}};
use tauri::{http, AppHandle, Emitter, Manager, Runtime, UriSchemeContext, UriSchemeResponder, Webview, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use xcap::{image::{imageops, RgbaImage}, Monitor};
use crate::storage::{encode_png, main_only, png_url, Storage, MAX_IMAGE_BYTES};

pub struct Frame { x: i32, y: i32, width: u32, height: u32, image: Arc<RgbaImage> }
/// One capture from request to selection. `frames` is empty until the screen has been read.
pub struct Active { generation: u64, frames: Vec<Frame>, started: Instant, editor: u64, settle: u64, grab: u64, shown: bool, options: Options }
/// Capture preferences read from settings when a capture starts.
#[derive(Clone, Copy, Default)]
struct Options { adjust: bool, magnifier: bool, copy: bool, save: bool, delay: u64 }
impl Options {
    fn read(app: &AppHandle) -> Self {
        let Ok(settings) = app.state::<Storage>().settings() else { return Options::default() };
        let on = |key: &str| settings[key].as_bool().unwrap_or(false);
        Options { adjust: on("adjustSelection"), magnifier: on("magnifier"), copy: on("copyOnCapture"), save: on("saveOnCapture"), delay: settings["captureDelay"].as_u64().unwrap_or(0).min(10) }
    }
    /// What an overlay needs to know about a capture.
    fn overlay(&self, generation: u64) -> Value { json!({"generation": generation, "adjust": self.adjust, "magnifier": self.magnifier}) }
}
/// `active` is `Some` while a capture is in progress and holds the frozen frame of every monitor.
#[derive(Default)]
pub struct CaptureState { active: Mutex<Option<Active>>, requested: Mutex<Option<(Instant, bool)>>, last: Mutex<Option<Value>> }
/// Identifies a capture so a reused overlay never shows or answers for an earlier one.
static GENERATION: AtomicU64 = AtomicU64::new(0);

#[cfg(windows)]
#[link(name = "dwmapi")]
extern "system" {
    fn DwmFlush() -> i32;
    fn DwmSetWindowAttribute(hwnd: isize, attribute: u32, value: *const std::ffi::c_void, size: u32) -> i32;
}

/// Windows fades a hiding window out over about 200 ms, which left a ghost of the editor in the frozen frame.
/// While `on`, the editor hides and shows without that transition and is excluded from screen capture.
fn out_of_frame(window: &WebviewWindow, on: bool) {
    #[cfg(windows)]
    {
        let _ = window.set_content_protected(on);
        if let Ok(hwnd) = window.hwnd() {
            let disabled = on as i32;
            // DWMWA_TRANSITIONS_FORCEDISABLED
            unsafe { DwmSetWindowAttribute(hwnd.0 as isize, 3, &disabled as *const i32 as *const std::ffi::c_void, 4); }
        }
    }
    #[cfg(not(windows))]
    { let _ = (window, on); }
}

fn ms(duration: Duration) -> u64 { duration.as_millis() as u64 }
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
        frames.push(Frame { x: monitor.x().unwrap_or(0), y: monitor.y().unwrap_or(0), width: monitor.width().unwrap_or(image.width()), height: monitor.height().unwrap_or(image.height()), image: Arc::new(image) });
    }
    if frames.is_empty() { return Err(unavailable()); }
    Ok(frames)
}
/// The monitor slot of an overlay window label; `None` for the editor and anything else.
fn slot(label: &str) -> Option<usize> { label.strip_prefix("capture-").and_then(|i| i.parse().ok()) }
fn overlay_index(window: &WebviewWindow) -> Result<usize, String> {
    slot(window.label()).ok_or_else(|| "This action is only available while capturing.".into())
}

/// 24-bit bottom-up BMP. The webview decodes it with a plain copy, so the frozen frame is never compressed,
/// base64-encoded or sent through IPC on its way to the overlay.
pub fn bmp(image: &RgbaImage) -> Vec<u8> {
    let (width, height) = (image.width() as usize, image.height() as usize);
    let stride = (width * 3 + 3) & !3;
    let size = 54 + stride * height;
    let mut out = Vec::with_capacity(size);
    out.extend_from_slice(b"BM");
    out.extend_from_slice(&(size as u32).to_le_bytes());
    out.extend_from_slice(&[0; 4]);
    out.extend_from_slice(&54u32.to_le_bytes());
    out.extend_from_slice(&40u32.to_le_bytes());
    out.extend_from_slice(&(width as i32).to_le_bytes());
    out.extend_from_slice(&(height as i32).to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&24u16.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes());
    out.extend_from_slice(&((stride * height) as u32).to_le_bytes());
    out.extend_from_slice(&[0; 16]);
    out.resize(size, 0);
    if stride == 0 { return out; }
    let raw = image.as_raw();
    for (row, line) in out[54..].chunks_exact_mut(stride).enumerate() {
        let source = &raw[(height - 1 - row) * width * 4..][..width * 4];
        for (pixel, rgba) in line.chunks_exact_mut(3).zip(source.chunks_exact(4)) { pixel[0] = rgba[2]; pixel[1] = rgba[1]; pixel[2] = rgba[0]; }
    }
    out
}
fn frame_for<R: Runtime>(app: &AppHandle<R>, label: &str, path: &str) -> Option<Arc<RgbaImage>> {
    let index = slot(label)?;
    let generation: u64 = path.trim_matches('/').parse().ok()?;
    let state = app.state::<CaptureState>();
    let guard = state.active.lock().ok()?;
    let image = guard.as_ref().filter(|a| a.generation == generation).and_then(|a| a.frames.get(index)).map(|f| f.image.clone());
    image
}
/// `snipframe` protocol: an overlay reads only its own monitor's frame of the capture in progress, from memory.
pub fn frame_protocol<R: Runtime>(context: UriSchemeContext<'_, R>, request: http::Request<Vec<u8>>, responder: UriSchemeResponder) {
    let image = frame_for(context.app_handle(), context.webview_label(), request.uri().path());
    std::thread::spawn(move || {
        let response = match image {
            Some(image) => http::Response::builder().header("Content-Type", "image/bmp").header("Cache-Control", "no-store").body(bmp(&image)),
            None => http::Response::builder().status(404).body(Vec::new()),
        };
        responder.respond(response.unwrap_or_else(|_| http::Response::new(Vec::new())));
    });
}

/// Returns the overlay for a monitor slot, creating it hidden when it does not exist yet.
fn overlay(app: &AppHandle, index: usize) -> Result<WebviewWindow, String> {
    let label = format!("capture-{index}");
    if let Some(window) = app.get_webview_window(&label) { return Ok(window); }
    // Not focused at creation: a hidden overlay must never take the keyboard from the editor.
    let built = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(format!("index.html?capture={index}").into()))
        .title("Snipflag capture").decorations(false).resizable(false).skip_taskbar(true).always_on_top(true).shadow(false).visible(false).focused(false)
        .build();
    // Warm-up and a capture can ask for the same slot at once; the loser uses the winner's window.
    built.ok().or_else(|| app.get_webview_window(&label)).ok_or_else(|| "Could not open the capture overlay.".into())
}
/// Opens one hidden overlay per display ahead of time, so a capture only has to show it.
pub fn prewarm(app: &AppHandle) {
    let displays = app.get_webview_window("main").and_then(|w| w.available_monitors().ok()).map(|m| m.len()).unwrap_or(1).clamp(1, 8);
    for index in 0..displays { let _ = overlay(app, index); }
}
fn reveal(window: &WebviewWindow) {
    let _ = window.show(); let _ = window.set_focus();
    // Escape and Enter go to the page, so the webview itself needs the keyboard.
    let webview: &Webview = window.as_ref();
    let _ = webview.set_focus();
}
/// Notes when the shortcut or the tray asked for a capture: the tray menu needs time to fade, and the timing report starts here.
pub fn requested(app: &AppHandle, tray: bool) {
    if let Ok(mut requested) = app.state::<CaptureState>().requested.lock() { *requested = Some((Instant::now(), tray)); }
}
/// Waits until the compositor no longer shows the editor or the tray menu, so neither lands in the frozen frame.
async fn settle(main: Option<&WebviewWindow>, was_visible: bool, since_tray: Option<Duration>) {
    if let Some(rest) = since_tray.and_then(|since| Duration::from_millis(350).checked_sub(since)) { tokio::time::sleep(rest).await; }
    if !was_visible { return; }
    #[cfg(windows)]
    {
        // Reading a property goes through the event loop after the hide, so the hide has been applied when it returns.
        let _ = main.map(|w| w.is_visible());
        let flushing = Instant::now();
        let _ = tauri::async_runtime::spawn_blocking(|| for _ in 0..2 { unsafe { DwmFlush(); } }).await;
        // Two composition passes remove the editor, plus a margin. Without composition DwmFlush returns at once; wait a fixed time instead.
        tokio::time::sleep(Duration::from_millis(if flushing.elapsed() < Duration::from_millis(3) { 300 } else { 40 })).await;
    }
    #[cfg(not(windows))]
    { let _ = main; tokio::time::sleep(Duration::from_millis(300)).await; }
}
/// Hides every overlay for reuse, forgets frozen frames, and restores the editor.
fn finish(app: &AppHandle) {
    if let Ok(mut active) = app.state::<CaptureState>().active.lock() { active.take(); }
    for (label, window) in app.webview_windows() { if label.starts_with("capture-") { let _ = window.hide(); } }
    // Overlays drop their copy of the frame.
    let _ = app.emit("capture-end", ());
    // A capture always returns to the full workspace; a larger size the user chose is kept.
    if let Some(main) = app.get_webview_window("main") { let _ = crate::fit_workspace(&main, false); }
    crate::show_main(app);
    if let Some(main) = app.get_webview_window("main") { out_of_frame(&main, false); }
}
pub fn cancel(app: &AppHandle) {
    let active = app.state::<CaptureState>().active.lock().map(|s| s.is_some()).unwrap_or(false);
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
    let started = Instant::now();
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let options = Options::read(&app);
    let request = {
        let state = app.state::<CaptureState>();
        let mut guard = state.active.lock().map_err(|_| "Capture is unavailable.")?;
        if guard.is_some() { return Err("A capture is already in progress.".into()); }
        *guard = Some(Active { generation, frames: Vec::new(), started, editor: 0, settle: 0, grab: 0, shown: false, options });
        let request = state.requested.lock().ok().and_then(|mut r| r.take()).filter(|(at, _)| at.elapsed() < Duration::from_secs(10));
        request
    };
    let main = app.get_webview_window("main");
    let was_visible = main.as_ref().and_then(|w| w.is_visible().ok()).unwrap_or(false);
    if let Some(w) = &main { if was_visible { out_of_frame(w, true); } let _ = w.hide(); }
    settle(main.as_ref(), was_visible, request.filter(|r| r.1).map(|r| r.0.elapsed())).await;
    // An optional delay leaves time to open a menu or tooltip before the screen is frozen.
    if options.delay > 0 { tokio::time::sleep(Duration::from_secs(options.delay)).await; }
    let settled = Instant::now();
    let frames = match tauri::async_runtime::spawn_blocking(grab).await {
        Ok(Ok(frames)) => frames,
        Ok(Err(e)) => { finish(&app); return Err(e); }
        Err(_) => { finish(&app); return Err("Capture stopped unexpectedly.".into()); }
    };
    let grabbed = Instant::now();
    let geometry: Vec<(i32, i32, u32, u32)> = frames.iter().map(|f| (f.x, f.y, f.width, f.height)).collect();
    {
        let state = app.state::<CaptureState>();
        let mut guard = state.active.lock().map_err(|_| "Capture is unavailable.")?;
        match guard.as_mut() {
            Some(active) if active.generation == generation => {
                active.frames = frames;
                active.editor = request.map(|r| ms(started.saturating_duration_since(r.0))).unwrap_or(0);
                active.settle = ms(settled.duration_since(started)).saturating_sub(options.delay * 1000);
                active.grab = ms(grabbed.duration_since(settled));
            }
            // Cancelled while the screen was being read; the editor is already back.
            _ => return Ok(()),
        }
    }
    for (index, (x, y, width, height)) in geometry.into_iter().enumerate() {
        let window = match overlay(&app, index) { Ok(w) => w, Err(e) => { finish(&app); return Err(e); } };
        // macOS reports monitor bounds in points; other platforms report physical pixels.
        #[cfg(target_os = "macos")]
        { let _ = window.set_position(tauri::LogicalPosition::new(x as f64, y as f64)); let _ = window.set_size(tauri::LogicalSize::new(width as f64, height as f64)); }
        #[cfg(not(target_os = "macos"))]
        { let _ = window.set_position(tauri::PhysicalPosition::new(x, y)); let _ = window.set_size(tauri::PhysicalSize::new(width, height)); }
    }
    // Warm overlays load the frame on this event; one created just now asks with capture_state once it has loaded.
    let _ = app.emit("capture-begin", options.overlay(generation));
    // Overlays show themselves once the frozen frame is painted. Never leave the user without a visible window.
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(3)).await;
        let count = handle.state::<CaptureState>().active.lock().ok().and_then(|a| a.as_ref().filter(|a| a.generation == generation).map(|a| a.frames.len())).unwrap_or(0);
        for index in 0..count {
            if let Some(window) = handle.get_webview_window(&format!("capture-{index}")) { if !window.is_visible().unwrap_or(true) { reveal(&window); } }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn start_capture(window: WebviewWindow, app: AppHandle) -> Result<(), String> { main_only(&window)?; begin(app).await }
/// The capture this overlay should show, if one is in progress for its monitor slot.
#[tauri::command]
pub fn capture_state(window: WebviewWindow, app: AppHandle) -> Result<Option<Value>, String> {
    let index = overlay_index(&window)?;
    let state = app.state::<CaptureState>();
    let guard = state.active.lock().map_err(|_| "Capture is unavailable.")?;
    let capture = guard.as_ref().filter(|a| index < a.frames.len()).map(|a| a.options.overlay(a.generation));
    Ok(capture)
}
#[tauri::command]
pub fn capture_ready(window: WebviewWindow, app: AppHandle, generation: u64) -> Result<(), String> {
    overlay_index(&window)?;
    {
        let state = app.state::<CaptureState>();
        let mut guard = state.active.lock().map_err(|_| "Capture is unavailable.")?;
        // A reused overlay may still answer for a capture that has ended; it must stay hidden.
        let active = guard.as_mut().filter(|a| a.generation == generation).ok_or("This capture has ended.")?;
        if !active.shown {
            active.shown = true;
            let since_start = ms(active.started.elapsed()).saturating_sub(active.options.delay * 1000);
            let report = json!({
                "total": active.editor + since_start, "editor": active.editor, "settle": active.settle, "grab": active.grab,
                "overlay": since_start.saturating_sub(active.settle + active.grab),
            });
            if let Ok(mut last) = state.last.lock() { *last = Some(report); }
        }
    }
    reveal(&window);
    Ok(())
}
/// Durations in milliseconds of the most recent capture, from the request to the first visible overlay. No screen content.
#[tauri::command]
pub fn capture_timing(window: WebviewWindow, app: AppHandle) -> Result<Option<Value>, String> {
    main_only(&window)?;
    let last = app.state::<CaptureState>().last.lock().ok().and_then(|l| l.clone());
    Ok(last)
}
#[tauri::command]
pub async fn capture_select(window: WebviewWindow, app: AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    let index = overlay_index(&window)?;
    let (frame, options) = {
        let state = app.state::<CaptureState>(); let mut guard = state.active.lock().map_err(|_| "Capture is unavailable.")?;
        let mut active = guard.take().ok_or("This capture has ended.")?;
        if index >= active.frames.len() { return Err("This capture has ended.".into()); }
        (active.frames.swap_remove(index).image, active.options)
    };
    finish(&app);
    let handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let cropped = crop(&frame, x, y, width, height).ok_or("Select a larger area.")?;
        // `copied` is null unless the setting is on; false tells the editor the copy failed.
        let copied = options.copy.then(|| crate::files::copy_image(&handle, &cropped).is_ok());
        // Fast compression returns to the editor sooner; only an oversized result gets the slower, denser pass.
        let mut bytes = encode_png(&cropped, true)?;
        if bytes.len() > MAX_IMAGE_BYTES { bytes = encode_png(&cropped, false)?; }
        if bytes.len() > MAX_IMAGE_BYTES { return Err("The captured area exceeds 20 MB. Select a smaller area.".to_string()); }
        // `saved` is null unless the setting is on; false tells the editor the file could not be written.
        let saved = options.save.then(|| crate::files::save_capture(&handle, &bytes).is_ok());
        Ok(json!({"dataUrl": png_url(&bytes), "width": cropped.width(), "height": cropped.height(), "copied": copied, "saved": saved}))
    }).await.map_err(|_| "Could not finish the capture.".to_string()).and_then(|r| r);
    match result {
        Ok(payload) => { let _ = app.emit_to("main", "capture-complete", payload); }
        Err(message) => { let _ = app.emit_to("main", "capture-failed", message); }
    }
    Ok(())
}
#[tauri::command]
pub fn capture_cancel(window: WebviewWindow, app: AppHandle) -> Result<(), String> { overlay_index(&window)?; cancel(&app); Ok(()) }

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
    #[test] fn bmp_is_bottom_up_bgr_with_padded_rows() {
        // 3 x 2: the top row is red, green, blue; the bottom row is white.
        let mut image = RgbaImage::from_pixel(3, 2, xcap::image::Rgba([255, 255, 255, 255]));
        for (x, color) in [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]].into_iter().enumerate() { image.put_pixel(x as u32, 0, xcap::image::Rgba(color)); }
        let bytes = bmp(&image);
        // Each row is 9 bytes of pixels padded to 12.
        assert_eq!(bytes.len(), 54 + 12 * 2);
        assert_eq!(&bytes[..2], b"BM");
        assert_eq!(u32::from_le_bytes(bytes[2..6].try_into().unwrap()) as usize, bytes.len());
        assert_eq!(u32::from_le_bytes(bytes[10..14].try_into().unwrap()), 54);
        assert_eq!((i32::from_le_bytes(bytes[18..22].try_into().unwrap()), i32::from_le_bytes(bytes[22..26].try_into().unwrap())), (3, 2));
        assert_eq!(u16::from_le_bytes(bytes[28..30].try_into().unwrap()), 24);
        assert_eq!(&bytes[54..66], &[255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0]);
        assert_eq!(&bytes[66..78], &[0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 0, 0]);
    }
    #[test] fn only_overlay_windows_have_a_frame_slot() {
        assert_eq!(slot("capture-2"), Some(2));
        assert_eq!(slot("main"), None);
        assert_eq!(slot("capture-x"), None);
    }
}
