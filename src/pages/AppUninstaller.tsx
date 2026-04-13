import { AppWindow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AppUninstaller() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">App Uninstaller</h1>
        <p className="text-muted-foreground">Remove apps and all their leftover files</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AppWindow className="w-5 h-5" />
            App Uninstaller
          </CardTitle>
          <CardDescription>Coming in Phase 2</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Will list installed apps and find leftover files in ~/Library matching bundle ID.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
