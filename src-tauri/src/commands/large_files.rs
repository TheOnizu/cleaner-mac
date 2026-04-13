use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;
use walkdir::WalkDir;

use crate::state::ScanCancelFlag;

#[derive(Serialize, Clone, Debug)]
pub struct LargeFileEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub extension: String,
}

const SKIP_DIRS: &[&str] = &[
    "/System/Library",
    "/System/Volumes",
    "/private/var/vm",
    "/private/var/folders",
    "/Volumes",
    "/dev",
    "/proc",
    "/net",
    "/cores",
];

pub fn should_skip(path: &Path) -> bool {
    SKIP_DIRS.iter().any(|s| path.starts_with(s))
}

/// Pure inner function — testable without Tauri runtime.
pub(crate) fn find_large_files(
    root: PathBuf,
    min_bytes: u64,
    cancel: &AtomicBool,
    on_progress: &dyn Fn(u64),
) -> Result<Vec<LargeFileEntry>, String> {
    let mut entries: Vec<LargeFileEntry> = Vec::new();
    let mut scanned: u64 = 0;

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !should_skip(e.path()))
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if cancel.load(Ordering::Relaxed) {
            return Err("Scan cancelled".to_string());
        }
        scanned += 1;
        if scanned % 500 == 0 {
            on_progress(scanned);
        }
        if let Some(size) = entry.metadata().ok().map(|m| m.len()) {
            if size >= min_bytes {
                let path = entry.path().to_string_lossy().to_string();
                let name = entry.file_name().to_string_lossy().to_string();
                let extension = entry
                    .path()
                    .extension()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                entries.push(LargeFileEntry { path, name, size, extension });
            }
        }
    }

    entries.sort_by(|a, b| b.size.cmp(&a.size));
    Ok(entries)
}

/// Walk `root`, return all files >= `min_size_mb` MB, sorted by size descending.
/// Emits `scan-progress` events every 500 files. Supports cancellation.
#[tauri::command]
pub async fn scan_large_files(
    app: tauri::AppHandle,
    cancel_flag: tauri::State<'_, ScanCancelFlag>,
    root: Option<String>,
    min_size_mb: Option<u64>,
) -> Result<Vec<LargeFileEntry>, String> {
    let root_path = root
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default());
    let min_bytes = min_size_mb.unwrap_or(50) * 1024 * 1024;
    let flag = cancel_flag.flag();
    cancel_flag.reset();

    tokio::task::spawn_blocking(move || {
        find_large_files(root_path, min_bytes, &flag, &|scanned| {
            let _ = app.emit("scan-progress", serde_json::json!({ "scanned": scanned }));
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Reveal a file in Finder using `open -R`.
#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Move a user-selected file to the system Trash.
#[tauri::command]
pub async fn move_to_trash(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        trash::delete(&path).map_err(|e| format!("Failed to trash {path}: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn no_cancel() -> AtomicBool {
        AtomicBool::new(false)
    }

    #[test]
    fn should_skip_system_library() {
        assert!(should_skip(Path::new("/System/Library/Frameworks")));
    }

    #[test]
    fn should_skip_volumes() {
        assert!(should_skip(Path::new("/Volumes/ExternalDrive")));
    }

    #[test]
    fn should_not_skip_home() {
        assert!(!should_skip(&dirs::home_dir().unwrap()));
    }

    #[test]
    fn should_not_skip_applications() {
        assert!(!should_skip(Path::new("/Applications")));
    }

    #[test]
    fn scan_finds_large_files_in_temp_dir() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("small.bin"), vec![0u8; 1024 * 1024]).unwrap();
        fs::write(dir.path().join("large.bin"), vec![0u8; 60 * 1024 * 1024]).unwrap();

        let entries =
            find_large_files(dir.path().to_path_buf(), 50 * 1024 * 1024, &no_cancel(), &|_| {})
                .unwrap();

        assert_eq!(entries.len(), 1, "only the 60 MB file should be returned");
        assert_eq!(entries[0].name, "large.bin");
    }

    #[test]
    fn scan_results_sorted_by_size_descending() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.bin"), vec![0u8; 80 * 1024 * 1024]).unwrap();
        fs::write(dir.path().join("b.bin"), vec![0u8; 60 * 1024 * 1024]).unwrap();
        fs::write(dir.path().join("c.bin"), vec![0u8; 51 * 1024 * 1024]).unwrap();

        let entries =
            find_large_files(dir.path().to_path_buf(), 50 * 1024 * 1024, &no_cancel(), &|_| {})
                .unwrap();

        assert_eq!(entries.len(), 3);
        assert!(entries[0].size >= entries[1].size);
        assert!(entries[1].size >= entries[2].size);
    }

    #[test]
    fn cancel_flag_stops_scan() {
        let dir = tempdir().unwrap();
        for i in 0..10 {
            fs::write(
                dir.path().join(format!("f{i}.bin")),
                vec![0u8; 60 * 1024 * 1024],
            )
            .unwrap();
        }
        let cancel = AtomicBool::new(true); // pre-cancelled
        let result = find_large_files(dir.path().to_path_buf(), 1024, &cancel, &|_| {});
        assert!(result.is_err(), "scan should be cancelled immediately");
        assert_eq!(result.unwrap_err(), "Scan cancelled");
    }
}
