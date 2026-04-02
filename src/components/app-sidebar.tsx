"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { LayoutDashboard, Users, Settings, Activity, FolderOpen, Hexagon, LogOut, Bell } from "lucide-react"

const items = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Analytics",
    url: "#",
    icon: Activity,
  },
  {
    title: "Projects",
    url: "#",
    icon: FolderOpen,
  },
  {
    title: "Users",
    url: "#",
    icon: Users,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
]

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border p-4 h-16 flex justify-center">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">ClawPanel</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-medium px-4 mt-2">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="mt-2 space-y-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<a href={item.url} />} className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all py-5 px-4 mx-2 rounded-xl border border-transparent hover:border-sidebar-border/50">
                    <div className="flex items-center gap-3 w-full">
                      <item.icon className="h-5 w-5 opacity-70" />
                      <span className="font-medium text-sm">{item.title}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<a href="/" />} className="hover:bg-destructive/10 hover:text-destructive transition-all py-5 px-4 mx-2 rounded-xl text-muted-foreground">
              <div className="flex items-center gap-3 w-full">
                <LogOut className="h-5 w-5" />
                <span className="font-medium text-sm">Sign Out</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
