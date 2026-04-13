import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PermissionGateProps {
  children: React.ReactNode;
}

export function PermissionGate({ children }: PermissionGateProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  async function checkPermission() {
    setChecking(true);
    try {
      const granted = await invoke<boolean>("check_full_disk_access");
      setHasPermission(granted);
    } catch {
      setHasPermission(false);
    } finally {
      setChecking(false);
    }
  }

  async function openSystemSettings() {
    await invoke("open_privacy_settings");
  }

  if (hasPermission === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-[480px]">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <ShieldCheck className="w-16 h-16 text-primary" />
            </div>
            <CardTitle className="text-2xl">Full Disk Access Required</CardTitle>
            <CardDescription>
              cleaner-mac needs Full Disk Access to scan your system for junk files,
              caches, and other cleanable items.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <p className="font-medium">How to grant access:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Click "Open System Settings" below</li>
                <li>Go to Privacy &amp; Security → Full Disk Access</li>
                <li>Find <strong>cleaner-mac</strong> and toggle it on</li>
                <li>Come back here and click "I've granted access"</li>
              </ol>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={openSystemSettings}>
                Open System Settings
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button className="flex-1" onClick={checkPermission} disabled={checking}>
                {checking ? "Checking..." : "I've granted access"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-[480px]">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <ShieldAlert className="w-16 h-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Permission Not Granted</CardTitle>
            <CardDescription>
              Full Disk Access was not detected. Please follow the steps and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={openSystemSettings}>
              Open System Settings
            </Button>
            <Button className="flex-1" onClick={checkPermission} disabled={checking}>
              {checking ? "Checking..." : "Try again"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="w-3 h-3 text-green-500" />
          Full Disk Access
        </Badge>
      </div>
      {children}
    </>
  );
}
