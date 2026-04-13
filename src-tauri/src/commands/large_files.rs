use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct LargeFileEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub extension: String,
}

/// Directories to skip entirely — system internals, virtual filesystems, other volumes.
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

/// Walk `root`, return all files >= `min_size_mb` MB, sorted by size descending.
#[tauri::command]
pub async fn scan_large_files(
    root: Option<String>,
    min_size_mb: Option<u64>,
) -> Result<Vec<LargeFileEntry>, String> {
    let root_path = root
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default());
    let min_bytes = min_size_mb.unwrap_or(50) * 1024 * 1024;

    tokio::task::spawn_blocking(move || {
        let mut entries: Vec<LargeFileEntry> = WalkDir::new(&root_path)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| !should_skip(e.path()))
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter_map(|e| {
                let size = e.metadata().ok()?.len();
                if size < min_bytes {
                    return None;
                }
                let path = e.path().to_string_lossy().to_string();
                let name = e.file_name().to_string_lossy().to_string();
                let extension = e
                    .path()
                    .extension()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                Some(LargeFileEntry {
                    path,
                    name,
                    size,
                    extension,
                })
            })
            .collect();

        entries.sort_by(|a, b| b.size.cmp(&a.size));
        Ok::<Vec<LargeFileEntry>, String>(entries)
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
/// No path restriction — the user explicitly selected this file.
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
        let home = dirs::home_dir().unwrap();
        assert!(!should_skip(&home));
    }

    #[test]
    fn should_not_skip_applications() {
        assert!(!should_skip(Path::new("/Applications")));
    }

    #[test]
    fn scan_finds_large_files_in_temp_dir() {
        let dir = tempdir().unwrap();

        // 1 MB file — below 50 MB threshold → should NOT appear
        let small = dir.path().join("small.bin");
        fs::write(&small, vec![0u8; 1024 * 1024]).unwrap();

        // 60 MB file — above threshold → should appear
        let large = dir.path().join("large.bin");
        fs::write(&large, vec![0u8; 60 * 1024 * 1024]).unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let entries = rt
            .block_on(scan_large_files(
                Some(dir.path().to_string_lossy().to_string()),
                Some(50),
            ))
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

        let rt = tokio::runtime::Runtime::new().unwrap();
        let entries = rt
            .block_on(scan_large_files(
                Some(dir.path().to_string_lossy().to_string()),
                Some(50),
            ))
            .unwrap();

        assert_eq!(entries.len(), 3);
        assert!(entries[0].size >= entries[1].size);
        assert!(entries[1].size >= entries[2].size);
    }
}
