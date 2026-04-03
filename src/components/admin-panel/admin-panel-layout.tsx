"use client";

import { Sidebar } from "@/components/admin-panel/sidebar";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

export default function AdminPanelLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const sidebar = useStore(useSidebar, (x) => x);

  // Use defaults while hydrating the sidebar store to prevent "second flash"
  const isOpen = sidebar?.getOpenState() ?? true;
  const settings = sidebar?.settings ?? { disabled: false, isHoverOpen: false };
  return (
    <>
      <Sidebar />
      <main
        className={cn(
          "min-h-screen bg-zinc-50 dark:bg-zinc-900 transition-[margin-left] ease-in-out duration-300",
          !settings.disabled && (!isOpen ? "lg:ml-[90px]" : "lg:ml-72")
        )}
      >
        {children}
      </main>
    </>
  );
}
