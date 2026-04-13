# cleaner-mac

A macOS system cleaner built with [Tauri](https://tauri.app/) (Rust + React + TypeScript).  
Inspired by CleanMyMac — personal project, macOS 12+.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Rust (Tauri 2.x)
- **Key crates**: `walkdir`, `rayon`, `serde_json`, `plist`

## Requirements

- macOS 12+
- Full Disk Access granted to the app (the app will guide you through it)

---

## Roadmap

### Phase 0 — Scaffold & Foundation
- [x] Initialize Tauri + React + TypeScript project
- [x] Git repository + GitHub remote
- [ ] Install Tailwind CSS + shadcn/ui
- [ ] Sidebar navigation with routing (React Router)
- [ ] Full Disk Access permission gate (detect + guide user to System Settings)

### Phase 1 — Disk Overview + System Junk Cleaner
- [ ] Dashboard: total disk space, used, free (Rust `statvfs`)
- [ ] System junk scanner — known safe paths:
  - `~/Library/Caches/`
  - `/Library/Caches/`
  - `~/Library/Logs/`
  - `~/Library/Application Support/*/Cache*`
  - `~/Library/Developer/Xcode/DerivedData/`
  - `~/Library/Developer/Xcode/iOS DeviceSupport/`
  - `/tmp/`
- [ ] File list grouped by category with sizes + checkboxes
- [ ] Delete selected files (move to Trash)
- [ ] Rust unit tests for junk scanner paths
- [ ] Integration test: scan → select → delete flow

### Phase 2 — Large Files + App Uninstaller
- [ ] Large file finder: walk from `/`, filter by size threshold (default 50 MB)
- [ ] Sort by size, display path + size, open in Finder action
- [ ] App uninstaller: list `/Applications/` + `~/Applications/`
- [ ] Parse `Info.plist` for bundle ID per app
- [ ] Find leftover files in `~/Library/` matching bundle ID or app name
- [ ] Move app + leftovers to Trash
- [ ] Rust unit tests for leftover detection logic

### Phase 3 — Startup Items + Duplicate Finder
- [ ] Startup items: read `~/Library/LaunchAgents/`, `/Library/LaunchAgents/`, `/Library/LaunchDaemons/`
- [ ] Enable / disable items (write `Disabled` key to plist)
- [ ] Duplicate finder: user selects a folder, hash files with xxhash, group by hash
- [ ] Show duplicate groups, keep one, trash the rest
- [ ] Rust unit tests for hashing + grouping logic

### Phase 4 — Privacy Cleaner + Polish
- [ ] Browser cache cleaner: Chrome, Safari, Firefox (known paths)
- [ ] Recent items cleaner: `~/Library/Application Support/com.apple.sharedfilelist/`
- [ ] Dashboard summary: total space recovered, items cleaned
- [ ] Animated progress bars during scans
- [ ] Scan cancellation support
- [ ] End-to-end test pass for all features

---

## Project Structure

```
cleaner-mac/
├── src/                        # React frontend
│   ├── App.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── SystemJunk.tsx
│   │   ├── LargeFiles.tsx
│   │   ├── AppUninstaller.tsx
│   │   ├── StartupItems.tsx
│   │   ├── Duplicates.tsx
│   │   └── Privacy.tsx
│   └── components/
│       └── PermissionGate.tsx
└── src-tauri/src/              # Rust backend
    ├── main.rs
    └── commands/
        ├── disk.rs
        ├── junk.rs
        ├── large_files.rs
        ├── apps.rs
        ├── startup.rs
        ├── duplicates.rs
        └── privacy.rs
```

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Running Tests

```bash
# Rust tests
cd src-tauri && cargo test

# Frontend type check
npm run tsc --noEmit
```
