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
    <ScrollArea className="flex-1 [&>div>div[style]]:!block">
      <nav className="flex flex-col h-full py-3">
        <ul className="flex flex-col flex-1 min-h-[calc(100vh-72px-60px)] space-y-0.5 px-3">
          {menuList.map(({ groupLabel, menus }, index) => (
            <li className={cn("w-full", groupLabel ? "pt-5 first:pt-2" : "")} key={index}>
              {/* Group Label */}
              {(isOpen && groupLabel) || isOpen === undefined ? (
                <p className="sidebar-group-label px-3 pb-1.5 pt-1">
                  {groupLabel}
                </p>
              ) : !isOpen && isOpen !== undefined && groupLabel ? (
                <TooltipProvider>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger className="w-full">
                      <div className="w-full flex justify-center items-center py-1">
                        <Ellipsis className="h-3.5 w-3.5 text-white/20" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{groupLabel}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <div className="pb-1" />
              )}

              {/* Menu Items */}
              {menus.map(
                ({ href, label, icon: Icon, active, submenus }, index) =>
                  !submenus || submenus.length === 0 ? (
                    <div className="w-full" key={index}>
                      <TooltipProvider disableHoverableContent>
                        <Tooltip delayDuration={100}>
                          <TooltipTrigger asChild>
                            <Link
                              href={href}
                              prefetch={true}
                              className={cn(
                                "sidebar-nav-item group flex items-center gap-3 w-full rounded-lg px-3 h-10 mb-0.5",
                                (active === undefined &&
                                  (href === "/dashboard"
                                    ? pathname === "/dashboard"
                                    : pathname.startsWith(href))) ||
                                  active
                                  ? "sidebar-nav-item-active"
                                  : "sidebar-nav-item-inactive"
                              )}
                            >
                              <span className="flex-shrink-0">
                                <Icon size={17} />
                              </span>
                              <span
                                className={cn(
                                  "text-[13.5px] font-medium whitespace-nowrap transition-[transform,opacity] ease-in-out duration-300",
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
                            <TooltipContent side="right">
                              {label}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ) : (
                    <div className="w-full" key={index}>
                      <CollapseMenuButton
                        icon={Icon}
                        label={label}
                        active={
                          active === undefined
                            ? pathname.startsWith(href)
                            : active
                        }
                        submenus={submenus}
                        isOpen={isOpen}
                      />
                    </div>
                  )
              )}
            </li>
          ))}

          {/* Sign out — pinned to bottom */}
          <li className="w-full grow flex items-end pb-2">
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => logout()}
                    className={cn(
                      "sidebar-signout-btn group flex items-center gap-3 w-full rounded-lg px-3 h-10",
                      isOpen === false ? "justify-center" : ""
                    )}
                  >
                    <span className="flex-shrink-0">
                      <LogOut size={16} />
                    </span>
                    <span
                      className={cn(
                        "text-[13.5px] font-medium whitespace-nowrap transition-[transform,opacity] ease-in-out duration-300",
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
          </li>
        </ul>
      </nav>
    </ScrollArea>
  );
});

Menu.displayName = "Menu";
