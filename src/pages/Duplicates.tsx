import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Copy,
  Loader2,
  FolderOpen,
  Trash2,
  CheckSquare,
  Square,
  FolderSearch,
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

interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

type ScanState = "idle" | "scanning" | "done" | "deleting";

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

function dirName(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || "/";
}

export function Duplicates() {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanRoot, setScanRoot] = useState<string | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  // For each group (by hash), track which files are selected for deletion
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [error, setError] = useState<string | null>(null);

  async function pickFolder() {
    const result = await open({ directory: true, multiple: false });
    if (typeof result === "string") setScanRoot(result);
  }

  async function runScan() {
    if (!scanRoot) return;
    setScanState("scanning");
    setGroups([]);
    setSelected({});
    setError(null);
    try {
      const result = await invoke<DuplicateGroup[]>("scan_duplicates", {
        root: scanRoot,
      });
      setGroups(result);
      // Pre-select all but the first file in each group for deletion
      const initialSelected: Record<string, Set<string>> = {};
      for (const g of result) {
        initialSelected[g.hash] = new Set(g.files.slice(1));
      }
      setSelected(initialSelected);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanState("done");
    }
  }

  function toggleFile(hash: string, path: string) {
    setSelected((prev) => {
      const groupSet = new Set(prev[hash] ?? []);
      if (groupSet.has(path)) groupSet.delete(path);
      else groupSet.add(path);
      return { ...prev, [hash]: groupSet };
    });
  }

  async function deleteSelected() {
    const toDelete = Object.values(selected).flatMap((s) => Array.from(s));
    if (toDelete.length === 0) return;
    setScanState("deleting");
    setError(null);
    try {
      await invoke("move_to_trash", { path: toDelete[0] });
      // move_to_trash handles one path; call sequentially
      for (const path of toDelete) {
        await invoke("move_to_trash", { path });
      }
      // Remove deleted files from groups
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            files: g.files.filter(
              (f) => !(selected[g.hash] ?? new Set()).has(f)
            ),
          }))
          .filter((g) => g.files.length >= 2)
      );
      setSelected({});
    } catch (e) {
      setError(String(e));
    } finally {
      setScanState("done");
    }
  }

  const totalGroups = groups.length;
  const totalDuplicates = groups.reduce((acc, g) => acc + g.files.length - 1, 0);
  const wastedSpace = groups.reduce((acc, g) => acc + g.size * (g.files.length - 1), 0);

  const selectedPaths = Object.values(selected).flatMap((s) => Array.from(s));
  const selectedSize = selectedPaths.reduce((acc, path) => {
    const group = groups.find((g) => g.files.includes(path));
    return acc + (group?.size ?? 0);
  }, 0);

  return (
    <div className="p-6 space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Duplicate Finder</h1>
        <p className="text-muted-foreground">
          Find identical files and remove copies
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Choose Folder</CardTitle>
          <CardDescription>
            Select a folder to scan for duplicate files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={pickFolder} className="gap-2">
              <FolderOpen className="w-4 h-4" />
              {scanRoot ? "Change folder" : "Pick folder"}
            </Button>
            {scanRoot && (
              <span className="text-sm text-muted-foreground truncate flex-1">
                {scanRoot}
              </span>
            )}
          </div>
          <Button
            onClick={runScan}
            disabled={!scanRoot || scanState === "scanning"}
            className="gap-2"
          >
            {scanState === "scanning" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderSearch className="w-4 h-4" />
            )}
            {scanState === "scanning" ? "Scanning…" : "Scan for Duplicates"}
          </Button>
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
              Hashing files in {scanRoot}…
            </p>
            <Progress value={null} className="w-48" />
          </CardContent>
        </Card>
      )}

      {scanState === "done" && groups.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Copy className="w-10 h-10 text-green-500" />
            <p className="font-medium">No duplicates found</p>
            <p className="text-sm text-muted-foreground">
              Every file in the selected folder is unique.
            </p>
          </CardContent>
        </Card>
      )}

      {groups.length > 0 && (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{totalGroups}</strong> duplicate groups
            </span>
            <span>
              <strong className="text-foreground">{totalDuplicates}</strong> extra copies
            </span>
            <span>
              <strong className="text-foreground">{formatBytes(wastedSpace)}</strong> wasted
            </span>
          </div>

          <div className="space-y-4">
            {groups.map((group) => {
              const groupSelected = selected[group.hash] ?? new Set<string>();
              return (
                <Card key={group.hash}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Copy className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-semibold">
                          {fileName(group.files[0])}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {group.files.length} copies
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(group.size)} each ·{" "}
                        {formatBytes(group.size * (group.files.length - 1))} wasted
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {group.files.map((file, idx) => {
                        const isSelected = groupSelected.has(file);
                        const isKeep = idx === 0 && !isSelected;
                        return (
                          <li
                            key={file}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer"
                            onClick={() => toggleFile(group.hash, file)}
                          >
                            <button className="text-muted-foreground shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-destructive" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{fileName(file)}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {dirName(file)}
                              </p>
                            </div>
                            {isKeep && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                keep
                              </Badge>
                            )}
                            {isSelected && (
                              <Badge
                                variant="destructive"
                                className="text-xs shrink-0 opacity-70"
                              >
                                delete
                              </Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Sticky action bar */}
      {selectedPaths.length > 0 && (
        <div className="fixed bottom-0 left-64 right-0 bg-background/95 backdrop-blur border-t p-4 flex items-center justify-between">
          <p className="text-sm">
            <strong>{selectedPaths.length} copies</strong> selected —{" "}
            <strong>{formatBytes(selectedSize)}</strong> will be moved to Trash
          </p>
          <Button
            variant="destructive"
            onClick={deleteSelected}
            disabled={scanState === "deleting"}
            className="gap-2"
          >
            {scanState === "deleting" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {scanState === "deleting" ? "Moving to Trash…" : "Remove Duplicates"}
          </Button>
        </div>
      )}
    </div>
  );
}
