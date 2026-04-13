import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AppWindow,
  Loader2,
  Search,
  ChevronRight,
  Trash2,
  FolderOpen,
  CheckSquare,
  Square,
  ArrowLeft,
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
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/format";

interface AppInfo {
  path: string;
  name: string;
  bundle_id: string;
  version: string;
  size: number;
}

interface LeftoverEntry {
  path: string;
  name: string;
  size: number;
  location: string;
}

type PageState = "list" | "detail";

export function AppUninstaller() {
  const [pageState, setPageState] = useState<PageState>("list");
  const [loadingApps, setLoadingApps] = useState(false);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null);
  const [leftovers, setLeftovers] = useState<LeftoverEntry[]>([]);
  const [loadingLeftovers, setLoadingLeftovers] = useState(false);
  const [selectedLeftovers, setSelectedLeftovers] = useState<Set<string>>(new Set());
  const [uninstalling, setUninstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadApps() {
    setLoadingApps(true);
    setError(null);
    try {
      const result = await invoke<AppInfo[]>("get_installed_apps");
      setApps(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingApps(false);
    }
  }

  async function openApp(app: AppInfo) {
    setSelectedApp(app);
    setLeftovers([]);
    setSelectedLeftovers(new Set());
    setPageState("detail");
    setLoadingLeftovers(true);
    try {
      const result = await invoke<LeftoverEntry[]>("find_app_leftovers", {
        bundleId: app.bundle_id,
        appName: app.name,
      });
      setLeftovers(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingLeftovers(false);
    }
  }

  function goBack() {
    setPageState("list");
    setSelectedApp(null);
    setError(null);
  }

  function toggleLeftover(path: string) {
    setSelectedLeftovers((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAllLeftovers() {
    setSelectedLeftovers(new Set(leftovers.map((l) => l.path)));
  }

  async function handleUninstall() {
    if (!selectedApp) return;
    setUninstalling(true);
    setError(null);
    try {
      await invoke("uninstall_app", {
        appPath: selectedApp.path,
        leftoverPaths: Array.from(selectedLeftovers),
      });
      // Remove from apps list and go back
      setApps((prev) => prev.filter((a) => a.path !== selectedApp.path));
      goBack();
    } catch (e) {
      setError(String(e));
    } finally {
      setUninstalling(false);
    }
  }

  const filteredApps = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(filter.toLowerCase()) ||
      a.bundle_id.toLowerCase().includes(filter.toLowerCase())
  );

  const leftoverSize = leftovers
    .filter((l) => selectedLeftovers.has(l.path))
    .reduce((acc, l) => acc + l.size, 0);
  const totalRemoveSize =
    (selectedApp?.size ?? 0) + leftoverSize;

  // ── Detail view ──────────────────────────────────────────────────────────
  if (pageState === "detail" && selectedApp) {
    return (
      <div className="p-6 space-y-6 pb-24">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedApp.name}</h1>
            <p className="text-muted-foreground text-sm">
              {selectedApp.bundle_id} · v{selectedApp.version} ·{" "}
              {formatBytes(selectedApp.size)}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </p>
        )}

        {/* App bundle */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">App Bundle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm">
              <AppWindow className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 truncate text-muted-foreground">
                {selectedApp.path}
              </span>
              <span className="font-medium shrink-0">
                {formatBytes(selectedApp.size)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Leftovers */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Leftover Files
              </CardTitle>
              {leftovers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={selectAllLeftovers}
                >
                  Select all
                </Button>
              )}
            </div>
            <CardDescription>
              {loadingLeftovers
                ? "Searching…"
                : leftovers.length === 0
                ? "No leftover files found in ~/Library"
                : `${leftovers.length} items found in ~/Library`}
            </CardDescription>
          </CardHeader>
          {loadingLeftovers && (
            <CardContent className="py-6 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          )}
          {!loadingLeftovers && leftovers.length > 0 && (
            <CardContent className="p-0">
              <ul className="divide-y">
                {leftovers.map((entry) => (
                  <li
                    key={entry.path}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer"
                    onClick={() => toggleLeftover(entry.path)}
                  >
                    <button className="text-muted-foreground shrink-0">
                      {selectedLeftovers.has(entry.path) ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.location}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {formatBytes(entry.size)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>

        {/* Sticky uninstall bar */}
        <div className="fixed bottom-0 left-64 right-0 bg-background/95 backdrop-blur border-t p-4 flex items-center justify-between">
          <p className="text-sm">
            App + <strong>{selectedLeftovers.size} leftover(s)</strong> ={" "}
            <strong>{formatBytes(totalRemoveSize)}</strong> freed
          </p>
          <Button
            variant="destructive"
            onClick={handleUninstall}
            disabled={uninstalling}
            className="gap-2"
          >
            {uninstalling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {uninstalling ? "Uninstalling…" : `Uninstall ${selectedApp.name}`}
          </Button>
        </div>
      </div>
    );
  }

  // ── App list view ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">App Uninstaller</h1>
          <p className="text-muted-foreground">
            Remove apps and all their leftover files
          </p>
        </div>
        <Button
          onClick={loadApps}
          disabled={loadingApps}
          className="gap-2"
        >
          {loadingApps ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <AppWindow className="w-4 h-4" />
          )}
          {loadingApps ? "Loading…" : apps.length ? "Refresh" : "Load Apps"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </p>
      )}

      {apps.length === 0 && !loadingApps && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <AppWindow className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium">No apps loaded</p>
            <p className="text-sm text-muted-foreground">
              Click "Load Apps" to scan /Applications and ~/Applications.
            </p>
          </CardContent>
        </Card>
      )}

      {apps.length > 0 && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filter apps…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {filteredApps.length} app{filteredApps.length !== 1 ? "s" : ""}
            </p>
            <ul className="divide-y border rounded-lg overflow-hidden">
              {filteredApps.map((app) => (
                <li
                  key={app.path}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer"
                  onClick={() => openApp(app)}
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <AppWindow className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {app.bundle_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {app.version && (
                      <Badge variant="secondary" className="text-xs">
                        v{app.version}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatBytes(app.size)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
