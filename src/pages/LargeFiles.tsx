import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  FileSearch,
  Loader2,
  FolderOpen,
  ExternalLink,
  Trash2,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";

interface LargeFileEntry {
  path: string;
  name: string;
  size: number;
  extension: string;
}

const SCAN_ROOTS = [
  { label: "Home Folder", value: null },
  { label: "Full Disk  ⚠ slow", value: "/" },
];

const SIZE_THRESHOLDS = [
  { label: "50 MB+", value: 50 },
  { label: "100 MB+", value: 100 },
  { label: "250 MB+", value: 250 },
  { label: "500 MB+", value: 500 },
  { label: "1 GB+", value: 1024 },
];

type ScanState = "idle" | "scanning" | "done";

export function LargeFiles() {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [entries, setEntries] = useState<LargeFileEntry[]>([]);
  const [root, setRoot] = useState<string | null>(null);
  const [minSizeMb, setMinSizeMb] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [trashing, setTrashing] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);

  async function runScan() {
    setScanState("scanning");
    setEntries([]);
    setScannedCount(0);
    setError(null);

    const unlisten = await listen<{ scanned: number }>("scan-progress", (ev) => {
      setScannedCount(ev.payload.scanned);
    });

    try {
      const result = await invoke<LargeFileEntry[]>("scan_large_files", {
        root,
        minSizeMb,
      });
      setEntries(result);
    } catch (e) {
      if (!String(e).includes("cancelled")) setError(String(e));
    } finally {
      unlisten();
      setScanState("done");
    }
  }

  async function cancelScan() {
    await invoke("cancel_scan").catch(() => {});
  }

  async function handleReveal(path: string) {
    await invoke("reveal_in_finder", { path }).catch(() => {});
  }

  async function handleTrash(path: string) {
    setTrashing(path);
    try {
      await invoke("move_to_trash", { path });
      setEntries((prev) => prev.filter((e) => e.path !== path));
    } catch (e) {
      setError(String(e));
    } finally {
      setTrashing(null);
    }
  }

  const totalSize = entries.reduce((acc, e) => acc + e.size, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Large Files</h1>
        <p className="text-muted-foreground">
          Find files taking up the most space
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Scan Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Scan Location
            </p>
            <div className="flex gap-2 flex-wrap">
              {SCAN_ROOTS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setRoot(r.value)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    root === r.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Minimum Size
            </p>
            <div className="flex gap-2 flex-wrap">
              {SIZE_THRESHOLDS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setMinSizeMb(t.value)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    minSizeMb === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {scanState === "scanning" && (
              <Button variant="outline" onClick={cancelScan} className="gap-2">
                <X className="w-4 h-4" />
                Cancel
              </Button>
            )}
            <Button
              onClick={runScan}
              disabled={scanState === "scanning"}
              className="gap-2"
            >
              {scanState === "scanning" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSearch className="w-4 h-4" />
              )}
              {scanState === "scanning" ? "Scanning…" : "Scan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </p>
      )}

      {scanState === "scanning" && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Scanning{root ? " full disk" : " home folder"}…
            </p>
            <Progress value={null} className="w-48" />
            {scannedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {scannedCount.toLocaleString()} files checked
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {scanState === "done" && entries.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <FileSearch className="w-10 h-10 text-green-500" />
            <p className="font-medium">No large files found</p>
            <p className="text-sm text-muted-foreground">
              No files over {minSizeMb} MB in the selected location.
            </p>
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Results
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{entries.length} files</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(totalSize)} total
                </span>
              </div>
            </div>
            <CardDescription className="text-xs">
              Sorted by size · Click trash to move to Trash, folder to reveal in Finder
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {entries.map((entry) => (
                <li
                  key={entry.path}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                >
                  <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {entry.path}
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0 tabular-nums">
                    {formatBytes(entry.size)}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Reveal in Finder"
                      onClick={() => handleReveal(entry.path)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      title="Move to Trash"
                      disabled={trashing === entry.path}
                      onClick={() => handleTrash(entry.path)}
                    >
                      {trashing === entry.path ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
