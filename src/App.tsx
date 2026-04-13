import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionStatsProvider } from "@/contexts/SessionStats";
import { AppSidebar } from "@/components/AppSidebar";
import { PermissionGate } from "@/components/PermissionGate";
import { Dashboard } from "@/pages/Dashboard";
import { SystemJunk } from "@/pages/SystemJunk";
import { LargeFiles } from "@/pages/LargeFiles";
import { AppUninstaller } from "@/pages/AppUninstaller";
import { StartupItems } from "@/pages/StartupItems";
import { Duplicates } from "@/pages/Duplicates";
import { Privacy } from "@/pages/Privacy";

export default function App() {
  return (
    <TooltipProvider>
      <SessionStatsProvider>
        <BrowserRouter>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <PermissionGate>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/junk" element={<SystemJunk />} />
                  <Route path="/large-files" element={<LargeFiles />} />
                  <Route path="/apps" element={<AppUninstaller />} />
                  <Route path="/startup" element={<StartupItems />} />
                  <Route path="/duplicates" element={<Duplicates />} />
                  <Route path="/privacy" element={<Privacy />} />
                </Routes>
              </PermissionGate>
            </SidebarInset>
          </SidebarProvider>
        </BrowserRouter>
      </SessionStatsProvider>
    </TooltipProvider>
  );
}
