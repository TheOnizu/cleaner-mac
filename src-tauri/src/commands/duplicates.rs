use rayon::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub files: Vec<String>,
}

/// Read up to `limit` bytes from a file and compute its MD5 hash.
/// Using a byte limit avoids reading entire huge files; same-size same-prefix
/// files that differ later are caught because we verify size equality first.
/// For correctness we hash the full file (no limit in practice via u64::MAX).
fn hash_file(path: &Path) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let mut ctx = md5::Context::new();
    let mut buf = [0u8; 65536]; // 64 KB chunks
    loop {
        let n = file.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        ctx.consume(&buf[..n]);
    }
    Some(format!("{:x}", ctx.finalize()))
}

/// Walk `root`, group files by size, then hash same-size candidates in parallel.
/// Returns groups of 2+ files with identical content.
#[tauri::command]
pub async fn scan_duplicates(root: String) -> Result<Vec<DuplicateGroup>, String> {
    tokio::task::spawn_blocking(move || {
        // Phase 1 — group paths by size (no hashing yet)
        let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();

        for entry in WalkDir::new(&root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if let Ok(meta) = entry.metadata() {
                let size = meta.len();
                if size == 0 {
                    continue; // skip empty files
                }
                by_size.entry(size).or_default().push(entry.path().to_path_buf());
            }
        }

        // Phase 2 — hash only files that share a size with at least one other file
        let candidates: Vec<(u64, PathBuf)> = by_size
            .into_iter()
            .filter(|(_, paths)| paths.len() >= 2)
            .flat_map(|(size, paths)| paths.into_iter().map(move |p| (size, p)))
            .collect();

        // Compute hashes in parallel
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
                files.sort(); // deterministic order
                DuplicateGroup { hash, size, files }
            })
            .collect();

        // Sort groups: largest wasted space first (size * (count - 1))
        groups.sort_by(|a, b| {
            let waste_b = b.size * (b.files.len() as u64 - 1);
            let waste_a = a.size * (a.files.len() as u64 - 1);
            waste_b.cmp(&waste_a)
        });

        Ok::<Vec<DuplicateGroup>, String>(groups)
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
    fn scan_duplicates_finds_duplicate_files() {
        let dir = tempdir().unwrap();
        let content = b"identical file content for testing";
        fs::write(dir.path().join("copy1.txt"), content).unwrap();
        fs::write(dir.path().join("copy2.txt"), content).unwrap();
        fs::write(dir.path().join("copy3.txt"), content).unwrap();
        fs::write(dir.path().join("unique.txt"), b"different content xyz").unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let groups = rt
            .block_on(scan_duplicates(dir.path().to_string_lossy().to_string()))
            .unwrap();

        assert_eq!(groups.len(), 1, "should find exactly one duplicate group");
        assert_eq!(groups[0].files.len(), 3, "group should have 3 files");
    }

    #[test]
    fn scan_duplicates_skips_unique_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), b"unique A").unwrap();
        fs::write(dir.path().join("b.txt"), b"unique B").unwrap();
        fs::write(dir.path().join("c.txt"), b"unique C").unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let groups = rt
            .block_on(scan_duplicates(dir.path().to_string_lossy().to_string()))
            .unwrap();

        assert!(groups.is_empty(), "no duplicates should be found");
    }

    #[test]
    fn scan_duplicates_groups_sorted_by_wasted_space() {
        let dir = tempdir().unwrap();

        // Small duplicates: 10 bytes × 2 files = 10 bytes wasted
        let small = b"0123456789";
        fs::write(dir.path().join("s1.bin"), small).unwrap();
        fs::write(dir.path().join("s2.bin"), small).unwrap();

        // Large duplicates: 1000 bytes × 2 files = 1000 bytes wasted
        let large = vec![0u8; 1000];
        fs::write(dir.path().join("l1.bin"), &large).unwrap();
        fs::write(dir.path().join("l2.bin"), &large).unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let groups = rt
            .block_on(scan_duplicates(dir.path().to_string_lossy().to_string()))
            .unwrap();

        assert_eq!(groups.len(), 2);
        assert!(
            groups[0].size >= groups[1].size,
            "largest wasted-space group should come first"
        );
    }

    #[test]
    fn scan_duplicates_empty_directory() {
        let dir = tempdir().unwrap();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let groups = rt
            .block_on(scan_duplicates(dir.path().to_string_lossy().to_string()))
            .unwrap();
        assert!(groups.is_empty());
    }
}
