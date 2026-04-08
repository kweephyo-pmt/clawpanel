"use client";

import { Navbar } from "@/components/admin-panel/navbar";
import { Sidebar } from "@/components/admin-panel/sidebar";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

export default function AdminPanelLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const sidebar = useStore(useSidebar, (x) => x);
  const pathname = usePathname();

  // Use defaults while hydrating the sidebar store to prevent "second flash"
  const isOpen = sidebar?.getOpenState() ?? true;
  const settings = sidebar?.settings ?? { disabled: false, isHoverOpen: false };
  
  let title = "Overview";
  if (pathname?.includes("/crons")) title = "Crons Manager";
  else if (pathname?.includes("/kanban")) title = "Kanban Board";
  else if (pathname?.includes("/agents")) title = "Agents";
  else if (pathname?.includes("/skills")) title = "Skills";
  else if (pathname?.includes("/email")) title = "Email Processing";

  return (
    <>
      <Sidebar />
      <main
        className={cn(
          "min-h-screen bg-zinc-50 dark:bg-zinc-900 transition-[margin-left] ease-in-out duration-300 overflow-x-hidden",
          !settings.disabled && (!isOpen ? "lg:ml-[90px]" : "lg:ml-72")
        )}
      >
        <Navbar title={title} />
        {children}
      </main>
    </>
  );
}
