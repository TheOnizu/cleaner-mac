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
- [x] Install Tailwind CSS + shadcn/ui
- [x] Sidebar navigation with routing (React Router)
- [x] Full Disk Access permission gate (detect + guide user to System Settings)

### Phase 1 — Disk Overview + System Junk Cleaner
- [x] Dashboard: total disk space, used, free (Rust `statvfs`)
- [x] System junk scanner — known safe paths:
  - `~/Library/Caches/`
  - `/Library/Caches/`
  - `~/Library/Logs/`
  - `~/Library/Developer/Xcode/DerivedData/`
  - `~/Library/Developer/Xcode/iOS DeviceSupport/`
  - `/tmp/`
- [x] File list grouped by category with sizes + checkboxes
- [x] Delete selected files (move to Trash)
- [x] Rust unit tests: 10 tests passing (disk, junk scanner, safety guard)
- [x] TypeScript: zero type errors

### Phase 2 — Large Files + App Uninstaller
- [x] Large file finder: configurable root (Home or Full Disk) + size threshold
- [x] Sort by size, display path + size, Reveal in Finder + Move to Trash actions
- [x] App uninstaller: list `/Applications/` + `~/Applications/`
- [x] Parse `Info.plist` for bundle ID, display name, version per app
- [x] Find leftover files in 7 `~/Library/` locations matching bundle ID or app name
- [x] Move app + selected leftovers to Trash
- [x] Rust unit tests: 23 tests passing (skip dirs, file scan, app parsing, safety guards)
- [x] TypeScript: zero type errors

### Phase 3 — Startup Items + Duplicate Finder
- [x] Startup items: read `~/Library/LaunchAgents/`, `/Library/LaunchAgents/`, `/Library/LaunchDaemons/`
- [x] Enable / disable items (write `Disabled` key to plist); system items shown read-only
- [x] Duplicate finder: native folder picker, two-pass scan (group by size → MD5 hash candidates)
- [x] Show duplicate groups sorted by wasted space; pre-selects copies, keeps first file
- [x] Rust unit tests: 35 tests passing (plist parse, toggle guard, hash equality, group logic, sort order)
- [x] TypeScript: zero type errors

### Phase 4 — Privacy Cleaner + Polish
- [x] Browser cache cleaner: Chrome, Chrome Canary, Safari, Firefox (all profiles), Edge, Brave, Opera
- [x] Recent items cleaner: `~/Library/Application Support/com.apple.sharedfilelist/`
- [x] Dashboard: session stats card (space freed + items cleaned), quick-action grid
- [x] Progress events on System Junk scanner (per-source) and Large Files scanner (every 500 files)
- [x] Scan cancellation: `cancel_scan` command + Cancel button on Junk and Large Files pages
- [x] Session stats context (`SessionStats.tsx`) wired across all cleaning pages
- [x] Rust refactor: inner functions (`find_large_files`, `find_duplicates`) for testability
- [x] 41 Rust tests passing · TypeScript: zero errors

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
