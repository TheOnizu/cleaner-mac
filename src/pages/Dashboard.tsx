import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  HardDrive,
  Trash2,
  FileSearch,
  AppWindow,
  Rocket,
  Copy,
  Eye,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { useSessionStats } from "@/contexts/SessionStats";
import { useNavigate } from "react-router-dom";

interface DiskUsage {
  total: number;
  used: number;
  free: number;
}

const QUICK_ACTIONS = [
  { label: "System Junk", path: "/junk", icon: Trash2, desc: "Caches, logs, temp files" },
  { label: "Large Files", path: "/large-files", icon: FileSearch, desc: "Files over 50 MB" },
  { label: "App Uninstaller", path: "/apps", icon: AppWindow, desc: "Apps + leftovers" },
  { label: "Startup Items", path: "/startup", icon: Rocket, desc: "LaunchAgents" },
  { label: "Duplicates", path: "/duplicates", icon: Copy, desc: "Identical files" },
  { label: "Privacy", path: "/privacy", icon: Eye, desc: "Browser caches" },
];

export function Dashboard() {
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { spaceFreed, itemsCleaned, reset } = useSessionStats();
  const navigate = useNavigate();

  useEffect(() => {
    invoke<DiskUsage>("get_disk_usage")
      .then(setDisk)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const usedPercent = disk ? Math.round((disk.used / disk.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Mac's storage</p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Disk stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Disk</CardTitle>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {disk ? formatBytes(disk.total) : "—"}
            </div>
            <CardDescription>Macintosh HD</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Used</CardTitle>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {disk ? formatBytes(disk.used) : "—"}
            </div>
            <Progress value={usedPercent} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{usedPercent}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Free</CardTitle>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {disk ? formatBytes(disk.free) : "—"}
            </div>
            <CardDescription>Available space</CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Session stats */}
      {(spaceFreed > 0 || itemsCleaned > 0) && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-500" />
                Session Results
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={reset}
              >
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {formatBytes(spaceFreed)}
                </p>
                <p className="text-xs text-muted-foreground">freed this session</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{itemsCleaned}</p>
                <p className="text-xs text-muted-foreground">items cleaned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          <CardDescription>Jump to a cleaning tool</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                <action.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{action.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
