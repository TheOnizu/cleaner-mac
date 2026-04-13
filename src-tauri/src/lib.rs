mod commands;

use commands::apps::{find_app_leftovers, get_installed_apps, uninstall_app};
use commands::disk::get_disk_usage;
use commands::junk::{delete_files, scan_system_junk};
use commands::large_files::{move_to_trash, reveal_in_finder, scan_large_files};
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
            scan_large_files,
            reveal_in_finder,
            move_to_trash,
            get_installed_apps,
            find_app_leftovers,
            uninstall_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
