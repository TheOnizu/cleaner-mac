import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Trash2,
  ScanSearch,
  Loader2,
  FolderOpen,
  FileText,
  CheckSquare,
  Square,
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

interface JunkEntry {
  path: string;
  name: string;
  size: number;
  category: string;
}

type ScanState = "idle" | "scanning" | "done" | "deleting";

export function SystemJunk() {
  const [state, setState] = useState<ScanState>("idle");
  const [entries, setEntries] = useState<JunkEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Group entries by category
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
    setError(null);
    try {
      const result = await invoke<JunkEntry[]>("scan_system_junk");
      setEntries(result);
      setState("done");
    } catch (e) {
      setError(String(e));
      setState("idle");
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setState("deleting");
    setError(null);
    try {
      await invoke("delete_files", { paths: Array.from(selected) });
      // Remove deleted entries and clear selection
      setEntries((prev) => prev.filter((e) => !selected.has(e.path)));
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
    const categoryPaths =
      grouped.get(category)?.map((e) => e.path) ?? [];
    const allSelected = categoryPaths.every((p) => selected.has(p));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        categoryPaths.forEach((p) => next.delete(p));
      } else {
        categoryPaths.forEach((p) => next.add(p));
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(entries.map((e) => e.path)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <div className="p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Junk</h1>
          <p className="text-muted-foreground">
            Clean caches, logs, and temporary files
          </p>
        </div>
        <Button
          onClick={runScan}
          disabled={state === "scanning" || state === "deleting"}
          className="gap-2"
        >
          {state === "scanning" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ScanSearch className="w-4 h-4" />
          )}
          {state === "scanning" ? "Scanning…" : "Scan for Junk"}
        </Button>
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
              Scanning your system…
            </p>
            <Progress value={null} className="w-48" />
          </CardContent>
        </Card>
      )}

      {state === "idle" && entries.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <ScanSearch className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium">Ready to scan</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Click "Scan for Junk" to find caches, logs, and other safe-to-remove
              files on your Mac.
            </p>
          </CardContent>
        </Card>
      )}

      {state === "done" && entries.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Trash2 className="w-10 h-10 text-green-500" />
            <p className="font-medium">Your Mac looks clean!</p>
            <p className="text-sm text-muted-foreground">
              No junk files found.
            </p>
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Found{" "}
              <strong className="text-foreground">{entries.length} items</strong>{" "}
              totalling{" "}
              <strong className="text-foreground">{formatBytes(totalSize)}</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
          </div>

          {/* Category groups */}
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([category, items]) => {
              const catSize = items.reduce((acc, e) => acc + e.size, 0);
              const allCatSelected = items.every((e) => selected.has(e.path));
              return (
                <Card key={category}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {allCatSelected ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <CardTitle className="text-sm font-semibold">
                          {category}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {items.length}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(catSize)}
                      </span>
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
                          <span className="text-sm truncate flex-1">
                            {entry.name}
                          </span>
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

      {/* Sticky bottom action bar */}
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
