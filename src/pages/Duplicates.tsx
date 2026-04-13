import { Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Duplicates() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Duplicate Finder</h1>
        <p className="text-muted-foreground">Find and remove duplicate files</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Duplicate Scanner
          </CardTitle>
          <CardDescription>Coming in Phase 3</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Will hash files in a selected folder and group duplicates for you to review.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
