use serde_json::{json, Value};
use std::{borrow::Cow, sync::Mutex};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use xcap::image::RgbaImage;
use crate::storage::{decode_image, decode_png, encode_png, main_only, png_url, MAX_IMAGE_BYTES, MAX_PIXELS};

/// Kept alive for the whole process: on Linux the clipboard owner must outlive the copy.
pub struct ClipboardState(pub Mutex<Option<arboard::Clipboard>>);

fn with_clipboard<T>(app: &AppHandle, f: impl FnOnce(&mut arboard::Clipboard) -> Result<T, String>) -> Result<T, String> {
    let state = app.state::<ClipboardState>();
    let mut guard = state.0.lock().map_err(|_| "Clipboard is unavailable.")?;
    if guard.is_none() { *guard = Some(arboard::Clipboard::new().map_err(|_| "Clipboard is unavailable.")?); }
    f(guard.as_mut().ok_or("Clipboard is unavailable.")?)
}
/// Puts a captured image on the clipboard.
pub fn copy_image(app: &AppHandle, image: &RgbaImage) -> Result<(), String> {
    with_clipboard(app, |c| c.set_image(arboard::ImageData { width: image.width() as usize, height: image.height() as usize, bytes: Cow::Borrowed(image.as_raw()) }).map_err(|_| "Could not copy the image.".into()))
}
/// Turns a user-chosen file name into a safe default for the save picker.
pub fn safe_name(name: &str) -> String {
    let cleaned: String = name.chars().filter(|c| c.is_alphanumeric() || " -_().".contains(*c)).take(80).collect();
    let cleaned = cleaned.trim().trim_matches('.').to_string();
    if cleaned.is_empty() { "screenshot.png".into() } else if cleaned.to_ascii_lowercase().ends_with(".png") { cleaned } else { format!("{cleaned}.png") }
}

#[tauri::command]
pub async fn export_png(window: WebviewWindow, app: AppHandle, data_url: String, name: String, clipboard: bool) -> Result<bool, String> {
    main_only(&window)?;
    let (bytes, _, _) = decode_png(&data_url)?;
    if clipboard {
        let rgba = decode_image(&bytes)?.to_rgba8();
        let (width, height) = rgba.dimensions();
        with_clipboard(&app, |c| c.set_image(arboard::ImageData { width: width as usize, height: height as usize, bytes: Cow::Owned(rgba.into_raw()) }).map_err(|_| "Could not copy the image.".into()))?;
        return Ok(true);
    }
    // The only write target is the path the user picked in the native dialog.
    let picked = app.dialog().file().set_title("Save screenshot").add_filter("PNG image", &["png"]).set_file_name(safe_name(&name)).blocking_save_file();
    let Some(picked) = picked else { return Ok(false) };
    let mut path = picked.into_path().map_err(|_| "Choose a folder on this computer.")?;
    if path.extension().map_or(true, |e| !e.eq_ignore_ascii_case("png")) { path.set_extension("png"); }
    std::fs::write(&path, &bytes).map_err(|_| "Could not save the file. Check the folder permissions and free space.")?;
    Ok(true)
}
#[tauri::command]
pub fn read_clipboard_image(window: WebviewWindow, app: AppHandle) -> Result<Value, String> {
    main_only(&window)?;
    let image = with_clipboard(&app, |c| c.get_image().map_err(|_| "The clipboard does not contain an image.".into()))?;
    if image.width as u64 * image.height as u64 > MAX_PIXELS { return Err("The clipboard image exceeds 40 megapixels.".into()); }
    let rgba = RgbaImage::from_raw(image.width as u32, image.height as u32, image.bytes.into_owned()).ok_or("The clipboard image could not be read.")?;
    let bytes = encode_png(&rgba, false)?;
    if bytes.len() > MAX_IMAGE_BYTES { return Err("The clipboard image exceeds 20 MB.".into()); }
    Ok(json!({"dataUrl": png_url(&bytes), "width": rgba.width(), "height": rgba.height()}))
}
#[tauri::command]
pub fn copy_text(window: WebviewWindow, app: AppHandle, text: String) -> Result<(), String> {
    main_only(&window)?;
    if text.len() > 4096 { return Err("Text is too long to copy.".into()); }
    with_clipboard(&app, |c| c.set_text(text).map_err(|_| "Could not copy the link.".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn save_names_cannot_escape_the_picker() {
        assert_eq!(safe_name("../../etc/passwd"), "etcpasswd.png");
        assert_eq!(safe_name(""), "screenshot.png");
        assert_eq!(safe_name("Login bug.PNG"), "Login bug.PNG");
        assert_eq!(safe_name("C:\\x\\y"), "Cxy.png");
    }
}
