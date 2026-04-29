"use client";

import * as React from "react";
import Link from "next/link";
import { Ellipsis, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";

import { cn } from "@/lib/utils";
import { getMenuList } from "@/lib/menu-list";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CollapseMenuButton } from "@/components/admin-panel/collapse-menu-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "@/components/ui/tooltip";

interface MenuProps {
  isOpen: boolean | undefined;
}

export const Menu = React.memo(({ isOpen }: MenuProps) => {
  const pathname = usePathname();
  const { logout } = useAuth();
  const menuList = getMenuList(pathname);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Scrollable nav area */}
      <ScrollArea className="flex-1 [&>div>div[style]]:!block">
        <nav className="py-3 px-3">
          <ul className="flex flex-col space-y-0.5">
            {menuList.map(({ groupLabel, menus }, index) => (
              <li className={cn("w-full", groupLabel ? "pt-5 first:pt-1" : "")} key={index}>

                {/* Group label */}
                {(isOpen && groupLabel) || isOpen === undefined ? (
                  <p className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest px-3 pb-2 pt-1",
                    "text-slate-400/60"
                  )}>
                    {groupLabel}
                  </p>
                ) : !isOpen && isOpen !== undefined && groupLabel ? (
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger className="w-full">
                        <div className="w-full flex justify-center items-center py-1.5">
                          <Ellipsis className="h-3.5 w-3.5 text-slate-500/50" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{groupLabel}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}

                {/* Menu items */}
                {menus.map(
                  ({ href, label, icon: Icon, active, submenus }, idx) => {
                    const isActive =
                      (active === undefined &&
                        (href === "/dashboard"
                          ? pathname === "/dashboard"
                          : pathname.startsWith(href))) ||
                      active;

                    return !submenus || submenus.length === 0 ? (
                      <div className="w-full" key={idx}>
                        <TooltipProvider disableHoverableContent>
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <Link
                                href={href}
                                prefetch={true}
                                className={cn(
                                  // Base
                                  "relative group flex items-center gap-3 w-full rounded-lg px-3 h-10 mb-0.5",
                                  "text-[13.5px] font-medium transition-all duration-150 outline-none",
                                  // Left accent bar
                                  "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:rounded-r-full before:transition-all before:duration-200",
                                  isActive
                                    ? [
                                        // Active
                                        "bg-indigo-500/15 text-indigo-300",
                                        "before:h-[55%] before:bg-gradient-to-b before:from-indigo-400 before:to-violet-500",
                                      ]
                                    : [
                                        // Inactive + hover
                                        "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]",
                                        "before:h-0 hover:before:h-[55%] hover:before:bg-white/20",
                                      ]
                                )}
                              >
                                <span className={cn(
                                  "flex-shrink-0 transition-colors duration-150",
                                  isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"
                                )}>
                                  <Icon size={17} />
                                </span>
                                <span
                                  className={cn(
                                    "whitespace-nowrap transition-[transform,opacity] ease-in-out duration-300",
                                    isOpen === false
                                      ? "-translate-x-10 opacity-0 w-0 overflow-hidden"
                                      : "translate-x-0 opacity-100"
                                  )}
                                >
                                  {label}
                                </span>
                              </Link>
                            </TooltipTrigger>
                            {isOpen === false && (
                              <TooltipContent side="right">{label}</TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ) : (
                      <div className="w-full" key={idx}>
                        <CollapseMenuButton
                          icon={Icon}
                          label={label}
                          active={active === undefined ? pathname.startsWith(href) : active}
                          submenus={submenus}
                          isOpen={isOpen}
                        />
                      </div>
                    );
                  }
                )}
              </li>
            ))}
          </ul>
        </nav>
      </ScrollArea>

      {/* Sign out — always visible at the very bottom, outside scroll */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-white/[0.06]">
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <button
                onClick={() => logout()}
                className={cn(
                  "group relative flex items-center gap-3 w-full rounded-lg px-3 h-10",
                  "text-[13.5px] font-medium text-slate-500 transition-all duration-150",
                  "hover:text-red-400 hover:bg-red-500/[0.08]",
                  isOpen === false ? "justify-center" : ""
                )}
              >
                <span className="flex-shrink-0 transition-colors duration-150">
                  <LogOut size={16} />
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap transition-[transform,opacity] ease-in-out duration-300",
                    isOpen === false
                      ? "-translate-x-10 opacity-0 w-0 overflow-hidden"
                      : "translate-x-0 opacity-100"
                  )}
                >
                  Sign out
                </span>
              </button>
            </TooltipTrigger>
            {isOpen === false && (
              <TooltipContent side="right">Sign out</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
});

Menu.displayName = "Menu";
