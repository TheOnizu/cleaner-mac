import { FileSearch } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LargeFiles() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Large Files</h1>
        <p className="text-muted-foreground">Find and remove large files taking up space</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="w-5 h-5" />
            Large File Finder
          </CardTitle>
          <CardDescription>Coming in Phase 2</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Will walk your filesystem and surface files over 50 MB, sorted by size.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
