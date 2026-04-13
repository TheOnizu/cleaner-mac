import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Trash2,
  FileSearch,
  AppWindow,
  Rocket,
  Copy,
  Eye,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "System Junk", path: "/junk", icon: Trash2 },
  { title: "Large Files", path: "/large-files", icon: FileSearch },
  { title: "App Uninstaller", path: "/apps", icon: AppWindow },
  { title: "Startup Items", path: "/startup", icon: Rocket },
  { title: "Duplicates", path: "/duplicates", icon: Copy },
  { title: "Privacy", path: "/privacy", icon: Eye },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-base">cleaner-mac</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <NavLink to={item.path} end={item.path === "/"}>
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 text-xs text-muted-foreground">
        macOS 12+ · Tauri 2
      </SidebarFooter>
    </Sidebar>
  );
}
