import { Rocket } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StartupItems() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Startup Items</h1>
        <p className="text-muted-foreground">Manage what runs when your Mac starts</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Launch Agents &amp; Daemons
          </CardTitle>
          <CardDescription>Coming in Phase 3</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Will list ~/Library/LaunchAgents, /Library/LaunchAgents, and /Library/LaunchDaemons
            with enable/disable toggles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
