// Foja on the desktop: the web editor (apps/web, built with FOJA_DESKTOP=1) in the system's webview. The editor
// works as it does in a browser, projects in IndexedDB included; only what a webview cannot do comes through here:
// saving an export (a webview has no downloads) and opening a link in the browser (nor tabs).

// No console window next to the app on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;

use percent_encoding::percent_decode_str;
use tauri::ipc::{InvokeBody, Request};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Saves an export where the user chooses. The body of the call is the file; the header `foja-name`, its name
/// percent-encoded (headers are ASCII, names are not), which the save dialog suggests. False if they cancel.
#[tauri::command]
async fn save(app: AppHandle, request: Request<'_>) -> Result<bool, String> {
    let InvokeBody::Raw(data) = request.body() else {
        return Err("the file has to come as bytes".into());
    };
    let name = request
        .headers()
        .get("foja-name")
        .and_then(|v| v.to_str().ok())
        .map(|v| percent_decode_str(v).decode_utf8_lossy().into_owned())
        .unwrap_or_else(|| "foja".into());
    let mut dialog = app.dialog().file().set_file_name(&name);
    if let Some(ext) = Path::new(&name).extension().and_then(|e| e.to_str()) {
        dialog = dialog.add_filter(ext.to_uppercase(), &[ext]);
    }
    let Some(path) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Opens a web page in the user's browser: the editor's links to the documentation. Only https, so nothing in the
/// page can make it run a program or open a local file.
#[tauri::command]
fn open(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err(format!("not an https link: {url}"));
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save, open])
        .run(tauri::generate_context!())
        .expect("Foja could not start");
}
