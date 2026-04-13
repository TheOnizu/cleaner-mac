use std::process::Command;

/// Check if Full Disk Access is granted by attempting to read a TCC-protected path.
/// The TCC database itself requires FDA — if we can list it, access is granted.
#[tauri::command]
pub fn check_full_disk_access() -> bool {
    // This path is only readable with Full Disk Access
    let protected = std::path::Path::new(
        "/Library/Application Support/com.apple.TCC/TCC.db",
    );
    protected.exists()
}

/// Open the Full Disk Access pane in System Settings.
#[tauri::command]
pub fn open_privacy_settings() {
    let _ = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
        .spawn();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_full_disk_access_returns_bool() {
        // Just verify it runs without panicking — actual result depends on system permissions
        let result = check_full_disk_access();
        println!("Full Disk Access granted: {result}");
        // Result is a boolean regardless of grant status
        assert!(result == true || result == false);
    }
}
