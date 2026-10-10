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

/// Simpan file hasil export (Excel) ke folder Downloads pengguna. Nama yang sudah ada tidak ditimpa: "Laporan (1).xlsx".
/// WebView di aplikasi desktop tidak menangani unduhan blob seperti browser, jadi export lewat perintah ini.
#[tauri::command]
fn save_download(app: tauri::AppHandle, name: String, data: Vec<u8>) -> Result<String, String> {
    let dir = app
        .path()
        .download_dir()
        .or_else(|_| app.path().home_dir().map(|h| h.join("Downloads")))
        .or_else(|_| app.path().document_dir())
        .map_err(|e| format!("Folder Downloads tidak ditemukan: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // buang karakter yang tidak boleh ada di nama file Windows
    let clean: String = name.chars().map(|c| if "\\/:*?\"<>|".contains(c) || c.is_control() { '_' } else { c }).collect();
    let clean = if clean.trim().is_empty() { "export.xlsx".to_string() } else { clean };
    let p = std::path::Path::new(&clean);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("export").to_string();
    let ext = p.extension().and_then(|s| s.to_str()).map(|e| format!(".{e}")).unwrap_or_default();
    let mut path = dir.join(&clean);
    let mut i = 1;
    while path.exists() {
        path = dir.join(format!("{stem} ({i}){ext}"));
        i += 1;
    }
    std::fs::write(&path, data).map_err(|e| format!("Gagal menyimpan file: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

/// Buka file dengan aplikasi bawaan (Excel), atau tampilkan di folder bila `reveal`.
#[tauri::command]
fn open_path(path: String, reveal: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let r = if reveal {
        std::process::Command::new("explorer").arg(format!("/select,{path}")).spawn()
    } else {
        std::process::Command::new("explorer").arg(&path).spawn()
    };
    #[cfg(target_os = "macos")]
    let r = if reveal { std::process::Command::new("open").args(["-R", &path]).spawn() } else { std::process::Command::new("open").arg(&path).spawn() };
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = {
        let target = if reveal { std::path::Path::new(&path).parent().map(|p| p.to_string_lossy().to_string()).unwrap_or(path.clone()) } else { path.clone() };
        std::process::Command::new("xdg-open").arg(target).spawn()
    };
    r.map(|_| ()).map_err(|e| e.to_string())
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
        // Judul jendela: nama aplikasi + versi terpasang, mis. "Fortuner POS FOR WINDOWS · Versi 1.1.8"
        .setup(|app| {
            if let Some(w) = app.get_webview_window("main") {
                let v = app.package_info().version.to_string();
                let _ = w.set_title(&format!("Fortuner POS FOR WINDOWS · Versi {v}"));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![machine_info, list_printers, print_raw, print_tcp, save_download, open_path])
        .run(tauri::generate_context!())
        .expect("gagal menjalankan Fortuner POS");
}
