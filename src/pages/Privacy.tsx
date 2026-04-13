import { Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Privacy() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Privacy Cleaner</h1>
        <p className="text-muted-foreground">Clean browser caches and recent file history</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Privacy Scanner
          </CardTitle>
          <CardDescription>Coming in Phase 4</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Will clean browser caches (Chrome, Safari, Firefox) and recent items history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
