use rayon::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use walkdir::WalkDir;

use crate::state::ScanCancelFlag;

#[derive(Serialize, Clone)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub files: Vec<String>,
}

fn hash_file(path: &Path) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let mut ctx = md5::Context::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        ctx.consume(&buf[..n]);
    }
    Some(format!("{:x}", ctx.finalize()))
}

/// Pure inner function — testable without Tauri runtime.
pub(crate) fn find_duplicates(
    root: PathBuf,
    cancel: &AtomicBool,
) -> Result<Vec<DuplicateGroup>, String> {
    // Phase 1 — group by size
    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if cancel.load(Ordering::Relaxed) {
            return Err("Scan cancelled".to_string());
        }
        if let Ok(meta) = entry.metadata() {
            let size = meta.len();
            if size > 0 {
                by_size.entry(size).or_default().push(entry.path().to_path_buf());
            }
        }
    }

    // Phase 2 — hash same-size candidates in parallel
    let candidates: Vec<(u64, PathBuf)> = by_size
        .into_iter()
        .filter(|(_, paths)| paths.len() >= 2)
        .flat_map(|(size, paths)| paths.into_iter().map(move |p| (size, p)))
        .collect();

    let hashed: Vec<(u64, String, String)> = candidates
        .par_iter()
        .filter_map(|(size, path)| {
            let hash = hash_file(path)?;
            Some((*size, hash, path.to_string_lossy().to_string()))
        })
        .collect();

    // Phase 3 — group by (size, hash)
    let mut by_hash: HashMap<(u64, String), Vec<String>> = HashMap::new();
    for (size, hash, path) in hashed {
        by_hash.entry((size, hash.clone())).or_default().push(path);
    }

    let mut groups: Vec<DuplicateGroup> = by_hash
        .into_iter()
        .filter(|(_, files)| files.len() >= 2)
        .map(|((size, hash), mut files)| {
            files.sort();
            DuplicateGroup { hash, size, files }
        })
        .collect();

    groups.sort_by(|a, b| {
        let waste_b = b.size * (b.files.len() as u64 - 1);
        let waste_a = a.size * (a.files.len() as u64 - 1);
        waste_b.cmp(&waste_a)
    });

    Ok(groups)
}

/// Walk `root`, find duplicate files by content hash. Supports cancellation.
#[tauri::command]
pub async fn scan_duplicates(
    cancel_flag: tauri::State<'_, ScanCancelFlag>,
    root: String,
) -> Result<Vec<DuplicateGroup>, String> {
    let flag = cancel_flag.flag();
    cancel_flag.reset();

    tokio::task::spawn_blocking(move || find_duplicates(PathBuf::from(root), &flag))
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
    fn hash_file_same_content_same_hash() {
        let dir = tempdir().unwrap();
        let a = dir.path().join("a.txt");
        let b = dir.path().join("b.txt");
        fs::write(&a, b"duplicate content here").unwrap();
        fs::write(&b, b"duplicate content here").unwrap();
        assert_eq!(hash_file(&a), hash_file(&b));
    }

    #[test]
    fn hash_file_different_content_different_hash() {
        let dir = tempdir().unwrap();
        let a = dir.path().join("a.txt");
        let b = dir.path().join("b.txt");
        fs::write(&a, b"content A").unwrap();
        fs::write(&b, b"content B").unwrap();
        assert_ne!(hash_file(&a), hash_file(&b));
    }

    #[test]
    fn hash_file_nonexistent_returns_none() {
        assert!(hash_file(Path::new("/no/such/file.txt")).is_none());
    }

    #[test]
    fn scan_finds_duplicate_files() {
        let dir = tempdir().unwrap();
        let content = b"identical file content for testing";
        fs::write(dir.path().join("copy1.txt"), content).unwrap();
        fs::write(dir.path().join("copy2.txt"), content).unwrap();
        fs::write(dir.path().join("copy3.txt"), content).unwrap();
        fs::write(dir.path().join("unique.txt"), b"different content xyz").unwrap();

        let groups = find_duplicates(dir.path().to_path_buf(), &no_cancel()).unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].files.len(), 3);
    }

    #[test]
    fn scan_skips_unique_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), b"unique A").unwrap();
        fs::write(dir.path().join("b.txt"), b"unique B").unwrap();

        let groups = find_duplicates(dir.path().to_path_buf(), &no_cancel()).unwrap();
        assert!(groups.is_empty());
    }

    #[test]
    fn scan_sorted_by_wasted_space() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("s1.bin"), b"0123456789").unwrap();
        fs::write(dir.path().join("s2.bin"), b"0123456789").unwrap();
        fs::write(dir.path().join("l1.bin"), vec![0u8; 1000]).unwrap();
        fs::write(dir.path().join("l2.bin"), vec![0u8; 1000]).unwrap();

        let groups = find_duplicates(dir.path().to_path_buf(), &no_cancel()).unwrap();
        assert_eq!(groups.len(), 2);
        assert!(groups[0].size >= groups[1].size);
    }

    #[test]
    fn scan_empty_directory() {
        let dir = tempdir().unwrap();
        let groups = find_duplicates(dir.path().to_path_buf(), &no_cancel()).unwrap();
        assert!(groups.is_empty());
    }

    #[test]
    fn cancel_stops_scan() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.bin"), b"content").unwrap();
        let cancel = AtomicBool::new(true);
        let result = find_duplicates(dir.path().to_path_buf(), &cancel);
        assert!(result.is_err());
    }
}
