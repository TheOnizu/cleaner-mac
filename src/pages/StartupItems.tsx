import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Rocket, Loader2, RefreshCw, Lock, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface StartupItem {
  path: string;
  label: string;
  program: string;
  disabled: boolean;
  location: string;
  user_writable: boolean;
}

export function StartupItems() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StartupItem[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<StartupItem[]>("get_startup_items");
      setItems(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(item: StartupItem) {
    if (!item.user_writable) return;
    const newDisabled = !item.disabled;
    setToggling(item.path);
    setError(null);
    try {
      await invoke("toggle_startup_item", {
        path: item.path,
        disabled: newDisabled,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.path === item.path ? { ...i, disabled: newDisabled } : i
        )
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setToggling(null);
    }
  }

  // Group items by location
  const grouped = items.reduce<Record<string, StartupItem[]>>((acc, item) => {
    (acc[item.location] ??= []).push(item);
    return acc;
  }, {});

  const enabledCount = items.filter((i) => !i.disabled).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Startup Items</h1>
          <p className="text-muted-foreground">
            Manage what runs when your Mac starts
          </p>
        </div>
        <Button onClick={loadItems} disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {loading ? "Loading…" : items.length ? "Refresh" : "Load Items"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Rocket className="w-4 h-4" />
          <span>
            <strong className="text-foreground">{enabledCount}</strong> of{" "}
            <strong className="text-foreground">{items.length}</strong> items
            enabled at startup
          </span>
        </div>
      )}

      {/* Info note */}
      {items.length > 0 && (
        <div className="flex gap-2 p-3 rounded-md bg-muted text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Changes to User LaunchAgents take effect on next login.
            System items are shown read-only.
          </p>
        </div>
      )}

      {items.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Rocket className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium">No items loaded</p>
            <p className="text-sm text-muted-foreground">
              Click "Load Items" to scan LaunchAgents and LaunchDaemons.
            </p>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([location, locationItems]) => (
        <Card key={location}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{location}</CardTitle>
              <Badge variant="secondary">{locationItems.length}</Badge>
            </div>
            {location !== "User LaunchAgents" && (
              <CardDescription className="flex items-center gap-1 text-xs">
                <Lock className="w-3 h-3" />
                Read-only — requires admin to modify
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {locationItems.map((item) => (
                <li
                  key={item.path}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.program || item.path}
                    </p>
                  </div>

                  {item.user_writable ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {item.disabled ? "Disabled" : "Enabled"}
                      </span>
                      {toggling === item.path ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={!item.disabled}
                          onCheckedChange={() => handleToggle(item)}
                        />
                      )}
                    </div>
                  ) : (
                    <Badge
                      variant={item.disabled ? "outline" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {item.disabled ? "Disabled" : "Enabled"}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
