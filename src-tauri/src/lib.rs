mod commands;

use commands::disk::get_disk_usage;
use commands::junk::{delete_files, scan_system_junk};
use commands::permissions::{check_full_disk_access, open_privacy_settings};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_full_disk_access,
            open_privacy_settings,
            get_disk_usage,
            scan_system_junk,
            delete_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
