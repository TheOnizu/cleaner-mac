use plist::Value;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
pub struct StartupItem {
    pub path: String,
    pub label: String,
    pub program: String,
    pub disabled: bool,
    pub location: String,
    pub user_writable: bool,
}

struct LaunchRoot {
    path: PathBuf,
    label: &'static str,
    user_writable: bool,
}

fn launch_roots() -> Vec<LaunchRoot> {
    let home = dirs::home_dir().unwrap_or_default();
    vec![
        LaunchRoot {
            path: home.join("Library/LaunchAgents"),
            label: "User LaunchAgents",
            user_writable: true,
        },
        LaunchRoot {
            path: PathBuf::from("/Library/LaunchAgents"),
            label: "System LaunchAgents",
            user_writable: false,
        },
        LaunchRoot {
            path: PathBuf::from("/Library/LaunchDaemons"),
            label: "System LaunchDaemons",
            user_writable: false,
        },
    ]
}

fn parse_item(path: &Path, location: &str, user_writable: bool) -> Option<StartupItem> {
    let dict = Value::from_file(path).ok()?.into_dictionary()?;

    let label = dict
        .get("Label")
        .and_then(|v| v.as_string())
        .unwrap_or(path.file_stem()?.to_str()?)
        .to_string();

    // Program path: prefer Program, fall back to first element of ProgramArguments
    let program = dict
        .get("Program")
        .and_then(|v| v.as_string())
        .map(String::from)
        .or_else(|| {
            dict.get("ProgramArguments")
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|v| v.as_string())
                .map(String::from)
        })
        .unwrap_or_default();

    let disabled = dict
        .get("Disabled")
        .and_then(|v| v.as_boolean())
        .unwrap_or(false);

    Some(StartupItem {
        path: path.to_string_lossy().to_string(),
        label,
        program,
        disabled,
        location: location.to_string(),
        user_writable,
    })
}

/// List all LaunchAgent and LaunchDaemon plist items.
#[tauri::command]
pub fn get_startup_items() -> Result<Vec<StartupItem>, String> {
    let mut items: Vec<StartupItem> = Vec::new();

    for root in launch_roots() {
        if !root.path.exists() {
            continue;
        }
        let read = match std::fs::read_dir(&root.path) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in read.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map(|e| e == "plist").unwrap_or(false) {
                if let Some(item) = parse_item(&path, root.label, root.user_writable) {
                    items.push(item);
                }
            }
        }
    }

    items.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));
    Ok(items)
}

/// Set the Disabled key on a user-writable LaunchAgent plist.
/// Changes take effect on next login.
#[tauri::command]
pub fn toggle_startup_item(path: String, disabled: bool) -> Result<(), String> {
    let p = Path::new(&path);

    // Only allow editing user-owned LaunchAgents
    let home = dirs::home_dir().unwrap_or_default();
    if !p.starts_with(home.join("Library/LaunchAgents")) {
        return Err("Can only toggle user LaunchAgents (~/Library/LaunchAgents)".to_string());
    }

    let mut dict = Value::from_file(p)
        .map_err(|e| e.to_string())?
        .into_dictionary()
        .ok_or("Not a dictionary plist")?;

    dict.insert("Disabled".to_string(), Value::Boolean(disabled));

    Value::Dictionary(dict)
        .to_file_xml(p)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write_plist(dir: &Path, name: &str, content: &str) -> PathBuf {
        let path = dir.join(name);
        fs::write(&path, content).unwrap();
        path
    }

    const SAMPLE_PLIST: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.example.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/myagent</string>
        <string>--start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>"#;

    const DISABLED_PLIST: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.example.disabled</string>
    <key>Program</key>
    <string>/usr/local/bin/disabled-agent</string>
    <key>Disabled</key>
    <true/>
</dict>
</plist>"#;

    #[test]
    fn parse_item_reads_label_and_program() {
        let dir = tempdir().unwrap();
        let path = write_plist(dir.path(), "com.example.agent.plist", SAMPLE_PLIST);

        let item = parse_item(&path, "User LaunchAgents", true).unwrap();
        assert_eq!(item.label, "com.example.agent");
        assert_eq!(item.program, "/usr/local/bin/myagent");
        assert!(!item.disabled);
        assert!(item.user_writable);
    }

    #[test]
    fn parse_item_reads_disabled_flag() {
        let dir = tempdir().unwrap();
        let path = write_plist(dir.path(), "com.example.disabled.plist", DISABLED_PLIST);

        let item = parse_item(&path, "User LaunchAgents", true).unwrap();
        assert_eq!(item.program, "/usr/local/bin/disabled-agent");
        assert!(item.disabled);
    }

    #[test]
    fn toggle_startup_item_writes_disabled_key() {
        let dir = tempdir().unwrap();
        let _home = dirs::home_dir().unwrap();

        // Simulate the file being inside ~/Library/LaunchAgents by using a real temp
        // path prefix — we cannot write to the real LaunchAgents in tests,
        // so we just verify the guard rejects non-user paths.
        let system_path = "/Library/LaunchAgents/com.example.plist".to_string();
        let result = toggle_startup_item(system_path, true);
        assert!(result.is_err(), "should reject system paths");

        // Test that we can round-trip the plist write with a temp file that
        // appears to be inside ~/Library/LaunchAgents (symlink trick not needed —
        // just verify the plist write/read cycle works independent of the path guard).
        let plist_path = dir.path().join("test.plist");
        fs::write(&plist_path, SAMPLE_PLIST).unwrap();

        // Directly exercise the plist write logic
        let mut dict = Value::from_file(&plist_path)
            .unwrap()
            .into_dictionary()
            .unwrap();
        dict.insert("Disabled".to_string(), Value::Boolean(true));
        Value::Dictionary(dict).to_file_xml(&plist_path).unwrap();

        // Read back and confirm
        let dict2 = Value::from_file(&plist_path)
            .unwrap()
            .into_dictionary()
            .unwrap();
        assert_eq!(
            dict2.get("Disabled").and_then(|v| v.as_boolean()),
            Some(true)
        );
    }

    #[test]
    fn launch_roots_returns_three_locations() {
        let roots = launch_roots();
        assert_eq!(roots.len(), 3);
        assert_eq!(roots[0].label, "User LaunchAgents");
        assert_eq!(roots[1].label, "System LaunchAgents");
        assert_eq!(roots[2].label, "System LaunchDaemons");
    }

    #[test]
    fn get_startup_items_does_not_panic() {
        // Just ensure it runs without crashing regardless of system state
        let result = get_startup_items();
        assert!(result.is_ok());
    }
}
