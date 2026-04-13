use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::commands::junk::entry_size;

#[derive(Serialize, Clone)]
pub struct AppInfo {
    pub path: String,
    pub name: String,
    pub bundle_id: String,
    pub version: String,
    pub size: u64,
}

#[derive(Serialize, Clone)]
pub struct LeftoverEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub location: String,
}

/// Parse an .app bundle's Info.plist and return basic metadata.
fn read_app_info(app_path: &Path) -> Option<AppInfo> {
    let plist_path = app_path.join("Contents/Info.plist");
    let dict = plist::Value::from_file(&plist_path)
        .ok()?
        .into_dictionary()?;

    let stem = app_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let name = dict
        .get("CFBundleDisplayName")
        .or_else(|| dict.get("CFBundleName"))
        .and_then(|v| v.as_string())
        .unwrap_or(&stem)
        .to_string();

    let bundle_id = dict
        .get("CFBundleIdentifier")
        .and_then(|v| v.as_string())
        .unwrap_or("")
        .to_string();

    let version = dict
        .get("CFBundleShortVersionString")
        .and_then(|v| v.as_string())
        .unwrap_or("")
        .to_string();

    let size = entry_size(app_path);

    Some(AppInfo {
        path: app_path.to_string_lossy().to_string(),
        name,
        bundle_id,
        version,
        size,
    })
}

/// List all .app bundles in /Applications and ~/Applications.
#[tauri::command]
pub async fn get_installed_apps() -> Result<Vec<AppInfo>, String> {
    tokio::task::spawn_blocking(|| {
        let home = dirs::home_dir().unwrap_or_default();
        let roots = [
            PathBuf::from("/Applications"),
            home.join("Applications"),
        ];

        let mut apps: Vec<AppInfo> = roots
            .iter()
            .filter(|r| r.exists())
            .flat_map(|root| {
                std::fs::read_dir(root)
                    .into_iter()
                    .flatten()
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| p.extension().map(|e| e == "app").unwrap_or(false))
                    .filter_map(|p| read_app_info(&p))
            })
            .collect();

        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok::<Vec<AppInfo>, String>(apps)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Search ~/Library locations for files/dirs matching a bundle ID or app name.
#[tauri::command]
pub async fn find_app_leftovers(
    bundle_id: String,
    app_name: String,
) -> Result<Vec<LeftoverEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let home = dirs::home_dir().unwrap_or_default();

        // (directory, human label)
        let search_roots: &[(PathBuf, &str)] = &[
            (home.join("Library/Application Support"), "Application Support"),
            (home.join("Library/Preferences"), "Preferences"),
            (home.join("Library/Caches"), "Caches"),
            (home.join("Library/Logs"), "Logs"),
            (home.join("Library/Containers"), "Containers"),
            (home.join("Library/Group Containers"), "Group Containers"),
            (home.join("Library/Saved Application State"), "Saved State"),
        ];

        let bid_lower = bundle_id.to_lowercase();
        let name_lower = app_name.to_lowercase();

        let mut leftovers: Vec<LeftoverEntry> = Vec::new();

        for (root, label) in search_roots {
            if !root.exists() {
                continue;
            }
            let read = match std::fs::read_dir(root) {
                Ok(r) => r,
                Err(_) => continue,
            };
            for entry in read.filter_map(|e| e.ok()) {
                let path = entry.path();
                let entry_name = path.file_name().unwrap_or_default().to_string_lossy();
                let entry_lower = entry_name.to_lowercase();

                let matches = (!bid_lower.is_empty() && entry_lower.contains(&bid_lower))
                    || (!name_lower.is_empty() && entry_lower.contains(&name_lower));

                if matches {
                    let size = entry_size(&path);
                    leftovers.push(LeftoverEntry {
                        path: path.to_string_lossy().to_string(),
                        name: entry_name.to_string(),
                        size,
                        location: label.to_string(),
                    });
                }
            }
        }

        leftovers.sort_by(|a, b| b.size.cmp(&a.size));
        Ok::<Vec<LeftoverEntry>, String>(leftovers)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn is_safe_leftover(path: &Path) -> bool {
    let home = dirs::home_dir().unwrap_or_default();
    let safe_roots = [
        home.join("Library/Application Support"),
        home.join("Library/Preferences"),
        home.join("Library/Caches"),
        home.join("Library/Logs"),
        home.join("Library/Containers"),
        home.join("Library/Group Containers"),
        home.join("Library/Saved Application State"),
    ];
    safe_roots.iter().any(|r| path.starts_with(r))
}

fn is_app_bundle(path: &Path) -> bool {
    path.extension().map(|e| e == "app").unwrap_or(false)
        && (path.starts_with("/Applications")
            || dirs::home_dir()
                .map(|h| path.starts_with(h.join("Applications")))
                .unwrap_or(false))
}

/// Permanently delete the .app bundle and selected leftovers.
#[tauri::command]
pub async fn uninstall_app(
    app_path: String,
    leftover_paths: Vec<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let app = Path::new(&app_path);
        if !is_app_bundle(app) {
            return Err(format!("Not a valid app bundle path: {app_path}"));
        }
        std::fs::remove_dir_all(app).map_err(|e| format!("Failed to delete app: {e}"))?;

        for path_str in &leftover_paths {
            let path = Path::new(path_str);
            if !is_safe_leftover(path) {
                return Err(format!("Refusing to delete path outside safe roots: {path_str}"));
            }
            if path.is_dir() {
                std::fs::remove_dir_all(path)
                    .map_err(|e| format!("Failed to delete {path_str}: {e}"))?;
            } else {
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
    fn is_safe_leftover_allows_library_paths() {
        let home = dirs::home_dir().unwrap();
        assert!(is_safe_leftover(
            &home.join("Library/Application Support/com.example.app")
        ));
        assert!(is_safe_leftover(
            &home.join("Library/Preferences/com.example.app.plist")
        ));
        assert!(is_safe_leftover(&home.join("Library/Caches/com.example.app")));
        assert!(is_safe_leftover(&home.join("Library/Containers/com.example.app")));
        assert!(is_safe_leftover(
            &home.join("Library/Saved Application State/com.example.app.savedState")
        ));
    }

    #[test]
    fn is_safe_leftover_blocks_documents() {
        let home = dirs::home_dir().unwrap();
        assert!(!is_safe_leftover(&home.join("Documents/important.pdf")));
        assert!(!is_safe_leftover(&home.join("Desktop/readme.txt")));
        assert!(!is_safe_leftover(&PathBuf::from("/Applications/MyApp.app")));
    }

    #[test]
    fn is_app_bundle_valid() {
        assert!(is_app_bundle(Path::new("/Applications/Safari.app")));
    }

    #[test]
    fn is_app_bundle_rejects_non_app() {
        assert!(!is_app_bundle(Path::new("/Applications/something.dmg")));
        assert!(!is_app_bundle(Path::new("/usr/bin/ls")));
    }

    #[test]
    fn read_app_info_safari() {
        let safari = Path::new("/Applications/Safari.app");
        if safari.exists() {
            let info = read_app_info(safari).expect("Safari should parse");
            assert!(!info.bundle_id.is_empty());
            assert!(!info.name.is_empty());
        }
    }

    #[test]
    fn get_installed_apps_returns_nonempty_list() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let apps = rt.block_on(get_installed_apps()).unwrap();
        // /Applications always has at least Safari on macOS
        assert!(
            !apps.is_empty(),
            "/Applications should contain at least one app"
        );
    }

    #[test]
    fn installed_apps_sorted_alphabetically() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let apps = rt.block_on(get_installed_apps()).unwrap();
        if apps.len() >= 2 {
            for pair in apps.windows(2) {
                assert!(
                    pair[0].name.to_lowercase() <= pair[1].name.to_lowercase(),
                    "apps should be sorted A→Z"
                );
            }
        }
    }
}
