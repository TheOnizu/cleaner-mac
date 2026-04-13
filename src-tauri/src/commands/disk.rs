use serde::Serialize;

#[derive(Serialize)]
pub struct DiskUsage {
    pub total: u64,
    pub used: u64,
    pub free: u64,
}

/// Returns disk usage for the root volume using statvfs.
#[tauri::command]
pub fn get_disk_usage() -> Result<DiskUsage, String> {
    use std::ffi::CString;

    let path = CString::new("/").map_err(|e| e.to_string())?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    let ret = unsafe { libc::statvfs(path.as_ptr(), &mut stat) };
    if ret != 0 {
        return Err("statvfs syscall failed".to_string());
    }

    let block_size = stat.f_frsize as u64;
    let total = (stat.f_blocks as u64) * block_size;
    let free = (stat.f_bavail as u64) * block_size;
    let used = total.saturating_sub((stat.f_bfree as u64) * block_size);

    Ok(DiskUsage { total, used, free })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_disk_usage_returns_nonzero_values() {
        let usage = get_disk_usage().expect("statvfs should succeed on macOS");
        assert!(usage.total > 0, "total disk space should be > 0");
        assert!(usage.free > 0, "free disk space should be > 0");
        assert!(usage.used > 0, "used disk space should be > 0");
        // used is based on f_bfree (total free), free is f_bavail (available to user).
        // They differ by reserved blocks, so used + free <= total.
        assert!(usage.used + usage.free <= usage.total);
    }

    #[test]
    fn get_disk_usage_used_less_than_total() {
        let usage = get_disk_usage().expect("statvfs should succeed");
        assert!(usage.used < usage.total);
    }
}
