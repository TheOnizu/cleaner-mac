import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Trash2,
  ScanSearch,
  Loader2,
  FolderOpen,
  FileText,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import { useSessionStats } from "@/contexts/SessionStats";

interface JunkEntry {
  path: string;
  name: string;
  size: number;
  category: string;
}

interface ScanProgress {
  current: number;
  total: number;
  category: string;
}

type ScanState = "idle" | "scanning" | "done" | "deleting";

export function SystemJunk() {
  const [state, setState] = useState<ScanState>("idle");
  const [entries, setEntries] = useState<JunkEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addClean } = useSessionStats();

  const grouped = useMemo(() => {
    const map = new Map<string, JunkEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }, [entries]);

  const totalSize = entries.reduce((acc, e) => acc + e.size, 0);
  const selectedSize = entries
    .filter((e) => selected.has(e.path))
    .reduce((acc, e) => acc + e.size, 0);

  async function runScan() {
    setState("scanning");
    setEntries([]);
    setSelected(new Set());
    setProgress(null);
    setError(null);

    const unlisten = await listen<ScanProgress>("junk-scan-progress", (ev) => {
      setProgress(ev.payload);
    });

    try {
      const result = await invoke<JunkEntry[]>("scan_system_junk");
      setEntries(result);
      setState("done");
    } catch (e) {
      setError(String(e));
      setState("idle");
    } finally {
      unlisten();
      setProgress(null);
    }
  }

  async function cancelScan() {
    await invoke("cancel_scan").catch(() => {});
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setState("deleting");
    setError(null);
    const toDelete = Array.from(selected);
    const bytesToFree = entries
      .filter((e) => selected.has(e.path))
      .reduce((acc, e) => acc + e.size, 0);
    try {
      await invoke("delete_files", { paths: toDelete });
      setEntries((prev) => prev.filter((e) => !selected.has(e.path)));
      addClean(bytesToFree, toDelete.length);
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setState("done");
    }
  }

  function toggleEntry(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleCategory(category: string) {
    const paths = grouped.get(category)?.map((e) => e.path) ?? [];
    const allSelected = paths.every((p) => selected.has(p));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) paths.forEach((p) => next.delete(p));
      else paths.forEach((p) => next.add(p));
      return next;
    });
  }

  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Junk</h1>
          <p className="text-muted-foreground">Clean caches, logs, and temp files</p>
        </div>
        {state === "scanning" ? (
          <Button variant="outline" onClick={cancelScan} className="gap-2">
            <X className="w-4 h-4" />
            Cancel
          </Button>
        ) : (
          <Button
            onClick={runScan}
            disabled={state === "deleting"}
            className="gap-2"
          >
            <ScanSearch className="w-4 h-4" />
            Scan for Junk
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </p>
      )}

      {state === "scanning" && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {progress ? `Scanning ${progress.category}…` : "Preparing scan…"}
            </p>
            <Progress value={progressPercent || null} className="w-64" />
            {progress && (
              <p className="text-xs text-muted-foreground">
                {progress.current} / {progress.total}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {state === "idle" && entries.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <ScanSearch className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium">Ready to scan</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Click "Scan for Junk" to find safe-to-remove files on your Mac.
            </p>
          </CardContent>
        </Card>
      )}

      {state === "done" && entries.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Trash2 className="w-10 h-10 text-green-500" />
            <p className="font-medium">Your Mac looks clean!</p>
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && (
        <>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Found <strong className="text-foreground">{entries.length} items</strong> ·{" "}
              <strong className="text-foreground">{formatBytes(totalSize)}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set(entries.map((e) => e.path)))}
            >
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>

          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([category, items]) => {
              const catSize = items.reduce((acc, e) => acc + e.size, 0);
              const allSelected = items.every((e) => selected.has(e.path));
              return (
                <Card key={category}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleCategory(category)}>
                          {allSelected ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        <CardTitle className="text-sm font-semibold">{category}</CardTitle>
                        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatBytes(catSize)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {items.map((entry) => (
                        <li
                          key={entry.path}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40 cursor-pointer"
                          onClick={() => toggleEntry(entry.path)}
                        >
                          <button className="text-muted-foreground shrink-0">
                            {selected.has(entry.path) ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          {entry.name.includes(".") ? (
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-sm truncate flex-1">{entry.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatBytes(entry.size)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-64 right-0 bg-background/95 backdrop-blur border-t p-4 flex items-center justify-between">
          <p className="text-sm">
            <strong>{selected.size} items</strong> selected —{" "}
            <strong>{formatBytes(selectedSize)}</strong> will be moved to Trash
          </p>
          <Button
            variant="destructive"
            onClick={deleteSelected}
            disabled={state === "deleting"}
            className="gap-2"
          >
            {state === "deleting" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {state === "deleting" ? "Moving to Trash…" : "Move to Trash"}
          </Button>
        </div>
      )}
    </div>
  );
}
