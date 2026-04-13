import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HardDrive, Trash2 } from "lucide-react";
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
import { useNavigate } from "react-router-dom";

interface DiskUsage {
  total: number;
  used: number;
  free: number;
}

export function Dashboard() {
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        <p className="text-sm text-destructive">
          Could not read disk info: {error}
        </p>
      )}

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

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common cleaning tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="gap-2"
            onClick={() => navigate("/junk")}
          >
            <Trash2 className="w-4 h-4" />
            Scan for System Junk
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
