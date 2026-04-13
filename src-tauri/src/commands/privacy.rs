use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::commands::junk::entry_size;

#[derive(Serialize, Clone)]
pub struct PrivacyEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub category: String,
    pub browser: String,
}

struct PrivacySource {
    category: &'static str,
    browser: &'static str,
    path: PathBuf,
}

fn privacy_sources() -> Vec<PrivacySource> {
    let home = dirs::home_dir().unwrap_or_default();
    let support = home.join("Library/Application Support");
    let caches = home.join("Library/Caches");

    let mut sources = vec![
        PrivacySource {
            category: "Browser Caches",
            browser: "Safari",
            path: caches.join("com.apple.Safari"),
        },
        PrivacySource {
            category: "Browser Caches",
            browser: "Chrome",
            path: support.join("Google/Chrome/Default/Cache"),
        },
        PrivacySource {
            category: "Browser Caches",
            browser: "Chrome Canary",
            path: support.join("Google/Chrome Canary/Default/Cache"),
        },
        PrivacySource {
            category: "Browser Caches",
            browser: "Edge",
            path: support.join("Microsoft Edge/Default/Cache"),
        },
        PrivacySource {
            category: "Browser Caches",
            browser: "Brave",
            path: support.join("BraveSoftware/Brave-Browser/Default/Cache"),
        },
        PrivacySource {
            category: "Browser Caches",
            browser: "Opera",
            path: support.join("com.operasoftware.Opera/Default/Cache"),
        },
    ];

    // Firefox: dynamic profiles
    let ff_profiles = support.join("Firefox/Profiles");
    if ff_profiles.exists() {
        if let Ok(entries) = std::fs::read_dir(&ff_profiles) {
            for entry in entries.filter_map(|e| e.ok()) {
                let cache = entry.path().join("cache2");
                if cache.exists() {
                    sources.push(PrivacySource {
                        category: "Browser Caches",
                        browser: "Firefox",
                        path: cache,
                    });
                }
            }
        }
    }

    // Recent items (SFL files)
    let sfl = support.join("com.apple.sharedfilelist");
    if sfl.exists() {
        sources.push(PrivacySource {
            category: "Recent Items",
            browser: "",
            path: sfl,
        });
    }

    sources
}

/// Returns only sources that exist and have non-zero size.
#[tauri::command]
pub async fn scan_privacy_items() -> Result<Vec<PrivacyEntry>, String> {
    tokio::task::spawn_blocking(|| {
        let mut entries: Vec<PrivacyEntry> = privacy_sources()
            .into_iter()
            .filter(|s| s.path.exists())
            .filter_map(|source| {
                let size = entry_size(&source.path);
                if size == 0 {
                    return None;
                }
                let name = if source.browser.is_empty() {
                    source
                        .path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                } else {
                    format!("{} Cache", source.browser)
                };
                Some(PrivacyEntry {
                    path: source.path.to_string_lossy().to_string(),
                    name,
                    size,
                    category: source.category.to_string(),
                    browser: source.browser.to_string(),
                })
            })
            .collect();

        entries.sort_by(|a, b| a.category.cmp(&b.category).then(b.size.cmp(&a.size)));
        Ok::<Vec<PrivacyEntry>, String>(entries)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn is_safe_privacy_path(path: &Path) -> bool {
    let home = dirs::home_dir().unwrap_or_default();
    let support = home.join("Library/Application Support");
    let safe_roots = [
        home.join("Library/Caches/com.apple.Safari"),
        support.join("Google/Chrome"),
        support.join("Microsoft Edge"),
        support.join("BraveSoftware"),
        support.join("Firefox"),
        support.join("com.operasoftware.Opera"),
        support.join("com.apple.sharedfilelist"),
    ];
    safe_roots.iter().any(|r| path.starts_with(r))
}

/// Clean selected privacy items.
/// For directories: deletes the *contents* (not the directory itself).
/// For files: permanently deletes the file.
#[tauri::command]
pub async fn clean_privacy_items(paths: Vec<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        for path_str in &paths {
            let path = Path::new(path_str);
            if !is_safe_privacy_path(path) {
                return Err(format!("Not a recognised privacy path: {path_str}"));
            }
            if path.is_dir() {
                // Wipe contents so the browser recreates the dir fresh
                for child in std::fs::read_dir(path)
                    .map_err(|e| e.to_string())?
                    .filter_map(|e| e.ok())
                {
                    let p = child.path();
                    if p.is_dir() {
                        let _ = std::fs::remove_dir_all(&p);
                    } else {
                        let _ = std::fs::remove_file(&p);
                    }
                }
            } else if path.is_file() {
                std::fs::remove_file(path)
                    .map_err(|e| format!("Failed to delete {path_str}: {e}"))?;
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_safe_privacy_path_allows_browser_caches() {
        let home = dirs::home_dir().unwrap();
        let support = home.join("Library/Application Support");
        assert!(is_safe_privacy_path(
            &support.join("Google/Chrome/Default/Cache")
        ));
        assert!(is_safe_privacy_path(
            &support.join("BraveSoftware/Brave-Browser/Default/Cache")
        ));
        assert!(is_safe_privacy_path(
            &home.join("Library/Caches/com.apple.Safari")
        ));
        assert!(is_safe_privacy_path(
            &support.join("com.apple.sharedfilelist")
        ));
    }

    #[test]
    fn is_safe_privacy_path_blocks_other_paths() {
        let home = dirs::home_dir().unwrap();
        assert!(!is_safe_privacy_path(&home.join("Documents")));
        assert!(!is_safe_privacy_path(&home.join("Library/Caches")));
        assert!(!is_safe_privacy_path(Path::new("/Applications")));
    }

    #[test]
    fn privacy_sources_not_empty() {
        let sources = privacy_sources();
        assert!(!sources.is_empty());
    }

    #[test]
    fn privacy_sources_all_have_category() {
        for source in privacy_sources() {
            assert!(!source.category.is_empty(), "each source must have a category");
        }
    }
}
