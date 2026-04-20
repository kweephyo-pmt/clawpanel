import {
  LayoutDashboard,
  Mail,
  Clock,
  KanbanSquare,
  Wrench,
  Bot,
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
      groupLabel: "OpenClaw AI",
      menus: [
        {
          href: "/dashboard/agents",
          label: "Agents",
          icon: Bot
        },
        {
          href: "/dashboard/skills",
          label: "Skills",
          icon: Wrench
        },
        {
          href: "/dashboard/files",
          label: "File Manager",
          icon: FolderOpen
        },
        {
          href: "/dashboard/email",
          label: "Email Processing",
          icon: Mail
        }
      ]
    },
    {
      groupLabel: "Management",
      menus: [
        {
          href: "/dashboard/kanban",
          label: "Kanban",
          icon: KanbanSquare
        },
        {
          href: "/dashboard/crons",
          label: "Crons",
          icon: Clock
        }
      ]
    }
  ];
}
