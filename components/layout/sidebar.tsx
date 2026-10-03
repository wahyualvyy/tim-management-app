"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  Home,
  LogOut,
  Plus,
  Search,
  Settings,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/primitives";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/menu";
import { ProjectIcon } from "@/components/project/project-icon";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { ActiveTimerCard } from "@/components/timer/timer-display";
import { cn } from "@/lib/utils";
import type { ProjectIcon as IconKey } from "@/types/project";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { openCommandPalette } from "./command-events";

export interface SidebarProject {
  id: string;
  name: string;
  icon: IconKey;
}

export interface SidebarProps {
  user: { name: string; email: string; avatar: string | null };
  projects: SidebarProject[];
  unreadCount: number;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/my-tasks", label: "My tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-md text-[13px] transition-colors",
        collapsed ? "justify-center px-0" : "px-2",
        active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {collapsed ? null : <span className="truncate">{label}</span>}
      {badge ? (
        collapsed ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-label={`${badge} unread`} />
        ) : (
          <span className="tabular ml-auto rounded bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-fg">
            {badge > 99 ? "99+" : badge}
          </span>
        )
      ) : null}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function SidebarContent({ user, projects, unreadCount, collapsed, onToggleCollapsed, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-12 items-center", collapsed ? "justify-center" : "justify-between px-3")}>
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onNavigate} aria-label="Tim home">
          <LogoMark />
          {collapsed ? null : <span className="text-[15px] font-semibold tracking-tight">Tim</span>}
        </Link>
        {onToggleCollapsed && !collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-md p-1 text-subtle hover:bg-hover hover:text-fg"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className={cn("pb-2", collapsed ? "px-2" : "px-3")}>
        {collapsed ? (
          <Tooltip content="Search (Ctrl K)" side="right">
            <button
              type="button"
              onClick={openCommandPalette}
              className="flex h-8 w-full items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 text-[13px] text-subtle shadow-sm hover:border-border-strong"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="flex-1 text-left">Search…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
        )}
      </div>

      <nav className={cn("space-y-0.5", collapsed ? "px-2" : "px-3")} aria-label="Main">
        {NAV.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(item.href)}
            collapsed={collapsed}
            badge={item.href === "/notifications" ? unreadCount : undefined}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className={cn("mt-5 min-h-0 flex-1 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {collapsed ? null : (
          <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-subtle">Projects</p>
        )}
        <div className="space-y-0.5">
          {projects.map((p) => {
            const href = `/projects/${p.id}`;
            const active = isActive(href);
            const link = (
              <Link
                key={p.id}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md text-[13px] transition-colors",
                  collapsed ? "justify-center" : "px-2",
                  active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
                )}
              >
                <ProjectIcon icon={p.icon} size="sm" />
                {collapsed ? null : <span className="truncate">{p.name}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={p.id} content={p.name} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            );
          })}
          <NewProjectDialog
            trigger={(open) => (
              <Tooltip content="New project" side="right" disabled={!collapsed}>
                <button
                  type="button"
                  onClick={open}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md text-[13px] text-subtle hover:bg-hover hover:text-fg",
                    collapsed ? "justify-center" : "px-2",
                  )}
                  aria-label="New project"
                >
                  <span className="flex h-5 w-5 items-center justify-center">
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {collapsed ? null : "New project"}
                </button>
              </Tooltip>
            )}
          />
        </div>
      </div>

      <div className={cn("space-y-2 border-t border-border py-3", collapsed ? "px-2" : "px-3")}>
        <ActiveTimerCard collapsed={collapsed} />
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-10 w-full items-center gap-2.5 rounded-md text-left hover:bg-hover",
                collapsed ? "justify-center" : "px-2",
              )}
              aria-label="Account menu"
            >
              <Avatar name={user.name} src={user.avatar} size="sm" />
              {collapsed ? null : (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{user.name}</span>
                  <span className="block truncate text-[11px] text-muted">{user.email}</span>
                </span>
              )}
            </button>
          </MenuTrigger>
          <MenuContent align="start" className="w-60">
            <MenuLabel>{user.email}</MenuLabel>
            <MenuItem href="/profile" onSelect={onNavigate}>
              <UserIcon className="h-4 w-4 text-muted" aria-hidden /> Profile
            </MenuItem>
            <MenuItem href="/settings" onSelect={onNavigate}>
              <Settings className="h-4 w-4 text-muted" aria-hidden /> Settings
            </MenuItem>
            <MenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[13px] text-muted">Theme</span>
              <ThemeToggle />
            </div>
            <MenuSeparator />
            <MenuItem onSelect={() => void signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-4 w-4 text-muted" aria-hidden /> Sign out
            </MenuItem>
          </MenuContent>
        </Menu>
        {onToggleCollapsed && collapsed ? (
          <Tooltip content="Expand sidebar" side="right">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex h-8 w-full items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-fg"
              aria-label="Expand sidebar"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
