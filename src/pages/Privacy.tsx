import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Eye,
  ScanSearch,
  Loader2,
  CheckSquare,
  Square,
  Trash2,
  Globe,
  Clock,
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

interface PrivacyEntry {
  path: string;
  name: string;
  size: number;
  category: string;
  browser: string;
}

type ScanState = "idle" | "scanning" | "done" | "cleaning";

function BrowserIcon(_props: { browser: string }) {
  return <Globe className="w-4 h-4 text-muted-foreground shrink-0" />;
}

export function Privacy() {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [entries, setEntries] = useState<PrivacyEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const { addClean } = useSessionStats();

  // Group by category
  const grouped = entries.reduce<Record<string, PrivacyEntry[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {});

  const totalSize = entries.reduce((acc, e) => acc + e.size, 0);
  const selectedSize = entries
    .filter((e) => selected.has(e.path))
    .reduce((acc, e) => acc + e.size, 0);

  async function runScan() {
    setScanState("scanning");
    setEntries([]);
    setSelected(new Set());
    setError(null);
    try {
      const result = await invoke<PrivacyEntry[]>("scan_privacy_items");
      setEntries(result);
      setSelected(new Set(result.map((e) => e.path))); // pre-select all
    } catch (e) {
      setError(String(e));
    } finally {
      setScanState("done");
    }
  }

  async function cleanSelected() {
    if (selected.size === 0) return;
    setScanState("cleaning");
    setError(null);
    const toClean = Array.from(selected);
    const bytesToFree = entries
      .filter((e) => selected.has(e.path))
      .reduce((acc, e) => acc + e.size, 0);
    try {
      await invoke("clean_privacy_items", { paths: toClean });
      setEntries((prev) => prev.filter((e) => !selected.has(e.path)));
      addClean(bytesToFree, toClean.length);
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setScanState("done");
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
    const paths = (grouped[category] ?? []).map((e) => e.path);
    const allSelected = paths.every((p) => selected.has(p));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) paths.forEach((p) => next.delete(p));
      else paths.forEach((p) => next.add(p));
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Privacy Cleaner</h1>
          <p className="text-muted-foreground">
            Browser caches and recent items history
          </p>
        </div>
        <Button
          onClick={runScan}
          disabled={scanState === "scanning" || scanState === "cleaning"}
          className="gap-2"
        >
          {scanState === "scanning" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ScanSearch className="w-4 h-4" />
          )}
          {scanState === "scanning" ? "Scanning…" : "Scan"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </p>
      )}

      {scanState === "scanning" && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Scanning browsers and recent items…</p>
            <Progress value={null} className="w-48" />
          </CardContent>
        </Card>
      )}

      {scanState === "idle" && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Eye className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium">Ready to scan</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Scans Chrome, Safari, Firefox, Edge, Brave caches and macOS recent items list.
            </p>
          </CardContent>
        </Card>
      )}

      {scanState === "done" && entries.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Eye className="w-10 h-10 text-green-500" />
            <p className="font-medium">Nothing found</p>
            <p className="text-sm text-muted-foreground">
              No browser caches or recent items detected.
            </p>
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
            {Object.entries(grouped).map(([category, items]) => {
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
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer"
                          onClick={() => toggleEntry(entry.path)}
                        >
                          <button className="text-muted-foreground shrink-0">
                            {selected.has(entry.path) ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          {entry.category === "Recent Items" ? (
                            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <BrowserIcon browser={entry.browser} />
                          )}
                          <span className="text-sm truncate flex-1">{entry.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
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
            <strong>{formatBytes(selectedSize)}</strong> will be cleaned
          </p>
          <Button
            variant="destructive"
            onClick={cleanSelected}
            disabled={scanState === "cleaning"}
            className="gap-2"
          >
            {scanState === "cleaning" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {scanState === "cleaning" ? "Cleaning…" : "Clean Selected"}
          </Button>
        </div>
      )}
    </div>
  );
}
