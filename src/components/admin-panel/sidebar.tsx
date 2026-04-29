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

      {/* Panel */}
      <div
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        className={cn(
          "relative h-full flex flex-col overflow-hidden",
          // Dark gradient panel
          "bg-gradient-to-b from-slate-950 to-[#0c1120]",
          "border-r border-white/[0.06]"
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            "flex-shrink-0 flex items-center gap-3 px-4 py-[18px]",
            "border-b border-white/[0.06]",
            !getOpenState() ? "justify-center" : ""
          )}
        >
          <Link href="/dashboard/agents" className="flex items-center gap-3 min-w-0">
            {/* Logo icon */}
            <div className={cn(
              "flex-shrink-0 flex items-center justify-center",
              "w-8 h-8 rounded-lg",
              "bg-gradient-to-br from-indigo-500 to-violet-600",
              "shadow-lg shadow-indigo-500/30"
            )}>
              <Hexagon className="h-[18px] w-[18px] text-white" />
            </div>

            {/* Brand name */}
            <span
              className={cn(
                "font-semibold text-[15px] tracking-tight text-white whitespace-nowrap",
                "transition-[transform,opacity] ease-in-out duration-300",
                !getOpenState()
                  ? "-translate-x-10 opacity-0 w-0 overflow-hidden"
                  : "translate-x-0 opacity-100"
              )}
            >
              ClawPanel
            </span>
          </Link>
        </div>

        {/* Navigation — fills remaining height */}
        <Menu isOpen={getOpenState()} />
      </div>
    </aside>
  );
}
