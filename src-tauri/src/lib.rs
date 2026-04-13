mod commands;
mod state;

use commands::apps::{find_app_leftovers, get_installed_apps, uninstall_app};
use commands::disk::get_disk_usage;
use commands::duplicates::scan_duplicates;
use commands::junk::{delete_files, scan_system_junk};
use commands::large_files::{move_to_trash, reveal_in_finder, scan_large_files};
use commands::permissions::{check_full_disk_access, open_privacy_settings};
use commands::privacy::{clean_privacy_items, scan_privacy_items};
use commands::startup::{get_startup_items, toggle_startup_item};
use state::ScanCancelFlag;

#[tauri::command]
fn cancel_scan(flag: tauri::State<'_, ScanCancelFlag>) {
    flag.0
        .store(true, std::sync::atomic::Ordering::Relaxed);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ScanCancelFlag::new())
        .invoke_handler(tauri::generate_handler![
            check_full_disk_access,
            open_privacy_settings,
            get_disk_usage,
            scan_system_junk,
            delete_files,
            scan_large_files,
            reveal_in_finder,
            move_to_trash,
            cancel_scan,
            get_installed_apps,
            find_app_leftovers,
            uninstall_app,
            get_startup_items,
            toggle_startup_item,
            scan_duplicates,
            scan_privacy_items,
            clean_privacy_items,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
