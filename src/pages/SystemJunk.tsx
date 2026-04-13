import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SystemJunk() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Junk</h1>
        <p className="text-muted-foreground">Clean caches, logs, and temporary files</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Junk Scanner
          </CardTitle>
          <CardDescription>Coming in Phase 1</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Will scan ~/Library/Caches, /Library/Caches, ~/Library/Logs,
            Xcode DerivedData, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
