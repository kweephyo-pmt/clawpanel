import {
  LayoutDashboard,
  Users,
  Settings,
  Activity,
  FolderOpen,
  LucideIcon
} from "lucide-react";

type Submenu = {
  href: string;
  label: string;
  active?: boolean;
};

type Menu = {
  href: string;
  label: string;
  active?: boolean;
  icon: LucideIcon;
  submenus?: Submenu[];
};

type Group = {
  groupLabel: string;
  menus: Menu[];
};

export function getMenuList(pathname: string): Group[] {
  return [
    {
      groupLabel: "",
      menus: [
        {
          href: "/dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
          submenus: []
        }
      ]
    },
    {
      groupLabel: "Menu",
      menus: [
        {
          href: "/analytics",
          label: "Analytics",
          icon: Activity
        },
        {
          href: "/projects",
          label: "Projects",
          icon: FolderOpen
        },
        {
          href: "/users",
          label: "Users",
          icon: Users
        },
        {
          href: "/settings",
          label: "Settings",
          icon: Settings
        }
      ]
    }
  ];
}
