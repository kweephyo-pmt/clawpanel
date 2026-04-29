"use client";
import { Menu } from "@/components/admin-panel/menu";
import { SidebarToggle } from "@/components/admin-panel/sidebar-toggle";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";
import { Hexagon } from "lucide-react";
import Link from "next/link";

export function Sidebar() {
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  const { isOpen, toggleOpen, getOpenState, setIsHover, settings } = sidebar;
  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-20 h-screen -translate-x-full lg:translate-x-0 transition-[width] ease-in-out duration-300",
        !getOpenState() ? "w-[72px]" : "w-[260px]",
        settings.disabled && "hidden"
      )}
    >
      <SidebarToggle isOpen={isOpen} setIsOpen={toggleOpen} />
      <div
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        className="sidebar-panel relative h-full flex flex-col overflow-y-auto"
      >
        {/* Brand Header */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-white/5",
          !getOpenState() ? "justify-center" : ""
        )}>
          <Link href="/dashboard/agents" className="flex items-center gap-3 min-w-0">
            <div className="sidebar-logo-icon flex-shrink-0">
              <Hexagon className="h-[18px] w-[18px]" />
            </div>
            <span
              className={cn(
                "sidebar-brand-text font-semibold text-[15px] tracking-tight whitespace-nowrap transition-[transform,opacity] ease-in-out duration-300",
                !getOpenState() ? "-translate-x-10 opacity-0 w-0 overflow-hidden" : "translate-x-0 opacity-100"
              )}
            >
              ClawPanel
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <Menu isOpen={getOpenState()} />
      </div>
    </aside>
  );
}
