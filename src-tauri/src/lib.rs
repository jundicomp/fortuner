mod printing;

use serde::Serialize;
use std::time::Duration;
use tauri::Manager;

#[derive(Serialize)]
struct MachineInfo {
    id: String,
    hostname: String,
    version: String,
    os: String,
}

/// ID mesin (MachineGuid di Windows) + nama komputer. Aplikasi meng-hash ID ini sebelum dikirim ke server.
#[tauri::command]
fn machine_info(app: tauri::AppHandle) -> MachineInfo {
    MachineInfo {
        id: machine_uid::get().unwrap_or_default(),
        hostname: gethostname::gethostname().to_string_lossy().to_string(),
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
async fn list_printers() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(printing::list_printers).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn print_raw(printer: String, data: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || printing::print_raw(&printer, &data))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn print_tcp(host: String, port: u16, data: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || printing::print_tcp(&host, port, &data, Duration::from_secs(5)))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Hanya satu jendela: kalau ikon diklik lagi, jendela yang sudah ada dimunculkan.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![machine_info, list_printers, print_raw, print_tcp])
        .run(tauri::generate_context!())
        .expect("gagal menjalankan Fortuner POS");
}
