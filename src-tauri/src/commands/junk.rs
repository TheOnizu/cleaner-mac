use rayon::prelude::*;
use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct JunkEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub category: String,
}

struct JunkSource {
    category: &'static str,
    root: PathBuf,
}

/// Known safe paths to scan, grouped by display category.
fn junk_sources() -> Vec<JunkSource> {
    let home = dirs::home_dir().unwrap_or_default();
    vec![
        JunkSource {
            category: "User Caches",
            root: home.join("Library/Caches"),
        },
        JunkSource {
            category: "System Caches",
            root: PathBuf::from("/Library/Caches"),
        },
        JunkSource {
            category: "User Logs",
            root: home.join("Library/Logs"),
        },
        JunkSource {
            category: "System Logs",
            root: PathBuf::from("/Library/Logs"),
        },
        JunkSource {
            category: "Xcode",
            root: home.join("Library/Developer/Xcode/DerivedData"),
        },
        JunkSource {
            category: "Xcode",
            root: home.join("Library/Developer/Xcode/iOS DeviceSupport"),
        },
        JunkSource {
            category: "Temp Files",
            root: PathBuf::from("/tmp"),
        },
    ]
}

/// Recursively sum the size of all files under a path.
pub fn entry_size(path: &Path) -> u64 {
    if path.is_file() {
        return path.metadata().map(|m| m.len()).unwrap_or(0);
    }
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum()
}

/// List the immediate children of each junk directory, calculate their sizes in parallel.
/// Only entries with size > 0 are returned.
#[tauri::command]
pub async fn scan_system_junk() -> Result<Vec<JunkEntry>, String> {
    tokio::task::spawn_blocking(|| {
        let sources = junk_sources();
        let mut all_entries: Vec<JunkEntry> = Vec::new();

        for source in &sources {
            if !source.root.exists() {
                continue;
            }
            let read = match std::fs::read_dir(&source.root) {
                Ok(r) => r,
                Err(_) => continue,
            };
            let children: Vec<PathBuf> = read
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .collect();

            // Calculate sizes in parallel per category
            let entries: Vec<JunkEntry> = children
                .par_iter()
                .filter_map(|path| {
                    let size = entry_size(path);
                    if size == 0 {
                        return None;
                    }
                    let name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    Some(JunkEntry {
                        path: path.to_string_lossy().to_string(),
                        name,
                        size,
                        category: source.category.to_string(),
                    })
                })
                .collect();

            all_entries.extend(entries);
        }

        // Sort by size descending within each category
        all_entries.sort_by(|a, b| {
            a.category
                .cmp(&b.category)
                .then(b.size.cmp(&a.size))
        });

        Ok::<Vec<JunkEntry>, String>(all_entries)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Move the given file/directory paths to the system Trash.
#[tauri::command]
pub async fn delete_files(paths: Vec<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        for path_str in &paths {
            let path = Path::new(path_str);
            // Safety: only delete paths that are under known junk roots
            if !is_safe_to_delete(path) {
                return Err(format!("Refusing to delete path outside junk roots: {path_str}"));
            }
            trash::delete(path).map_err(|e| format!("Failed to trash {path_str}: {e}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Guard: only allow deleting paths that are children of known junk directories.
fn is_safe_to_delete(path: &Path) -> bool {
    let home = dirs::home_dir().unwrap_or_default();
    let safe_roots = [
        home.join("Library/Caches"),
        home.join("Library/Logs"),
        home.join("Library/Developer/Xcode/DerivedData"),
        home.join("Library/Developer/Xcode/iOS DeviceSupport"),
        PathBuf::from("/Library/Caches"),
        PathBuf::from("/Library/Logs"),
        PathBuf::from("/tmp"),
    ];
    safe_roots
        .iter()
        .any(|root| path.starts_with(root))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn entry_size_of_file() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, b"hello world").unwrap();
        assert_eq!(entry_size(&file), 11);
    }

    #[test]
    fn entry_size_of_directory() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), b"aaa").unwrap();
        fs::write(dir.path().join("b.txt"), b"bbbbb").unwrap();
        assert_eq!(entry_size(dir.path()), 8);
    }

    #[test]
    fn entry_size_nonexistent_returns_zero() {
        let path = Path::new("/this/does/not/exist/at/all");
        assert_eq!(entry_size(path), 0);
    }

    #[test]
    fn is_safe_to_delete_allows_junk_paths() {
        let home = dirs::home_dir().unwrap();
        let cache_entry = home.join("Library/Caches/com.example.app");
        assert!(is_safe_to_delete(&cache_entry));
    }

    #[test]
    fn is_safe_to_delete_blocks_home() {
        let home = dirs::home_dir().unwrap();
        assert!(!is_safe_to_delete(&home));
    }

    #[test]
    fn is_safe_to_delete_blocks_documents() {
        let home = dirs::home_dir().unwrap();
        let docs = home.join("Documents/important.pdf");
        assert!(!is_safe_to_delete(&docs));
    }

    #[test]
    fn junk_sources_not_empty() {
        let sources = junk_sources();
        assert!(!sources.is_empty());
    }
}
