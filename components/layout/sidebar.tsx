"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/menu";
import { ProjectIcon } from "@/components/project/project-icon";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { ActiveTimerCard } from "@/components/timer/timer-display";
import { cn } from "@/lib/utils";
import type { ProjectColor, ProjectIcon as IconKey } from "@/types/project";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { openCommandPalette } from "./command-events";

export interface SidebarProject {
  id: string;
  name: string;
  icon: IconKey;
  color: ProjectColor;
}

export interface SidebarProps {
  user: { name: string; username: string; avatar: string | null; isAdmin: boolean };
  /** The first few projects; `projectTotal` says how many there are in all. */
  projects: SidebarProject[];
  projectTotal: number;
  unreadCount: number;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const GROUPS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ href: "/dashboard", label: "Dasbor", icon: LayoutDashboard }] },
  {
    label: "Pekerjaan",
    items: [
      { href: "/projects", label: "Proyek Saya", icon: FolderKanban },
      { href: "/my-tasks", label: "Tugas Saya", icon: CheckSquare },
      { href: "/calendar", label: "Jadwal", icon: CalendarDays },
    ],
  },
  {
    label: "Kolaborasi",
    items: [
      { href: "/notifications", label: "Notifikasi", icon: Bell },
      { href: "/activity", label: "Aktivitas", icon: Activity },
    ],
  },
];

function NavLink({
  item,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-md text-[13px] transition-colors",
        collapsed ? "justify-center" : "px-2",
        active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {collapsed ? null : <span className="truncate">{item.label}</span>}
      {badge ? (
        collapsed ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-label={`${badge} belum dibaca`} />
        ) : (
          <span className="tabular ml-auto rounded-md bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-fg">
            {badge > 99 ? "99+" : badge}
          </span>
        )
      ) : null}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/profile", label: "Profil", icon: UserIcon },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function SidebarContent({ user, projects, projectTotal, unreadCount, collapsed, onToggleCollapsed, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const pad = collapsed ? "px-2" : "px-3";

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-12 shrink-0 items-center gap-1", collapsed ? "justify-center px-2" : "justify-between px-3")}>
        {collapsed ? null : (
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={onNavigate} aria-label="Tim — Dasbor">
            <LogoMark />
            <span className="text-[15px] font-semibold tracking-tight">Tim</span>
          </Link>
        )}
        {onToggleCollapsed ? (
          <Tooltip content={collapsed ? "Lebarkan sidebar (Ctrl B)" : "Ciutkan sidebar (Ctrl B)"} side="right">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
              className={cn(
                "flex items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                collapsed ? "h-9 w-9 border border-border" : "h-8 w-8",
              )}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </Tooltip>
        ) : null}
      </div>

      <div className={cn("shrink-0 pb-3", pad)}>
        {collapsed ? (
          <Tooltip content="Cari (Ctrl K)" side="right">
            <button
              type="button"
              onClick={openCommandPalette}
              className="flex h-8 w-full items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
              aria-label="Cari"
            >
              <Search className="h-4 w-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex h-8 w-full items-center gap-2 rounded-md bg-surface-2 px-2 text-[13px] text-subtle hover:text-muted"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="flex-1 text-left">Cari…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
        )}
      </div>

      <div className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto pb-3", pad)}>
        {GROUPS.map((group) => (
          <nav key={group.label ?? "main"} aria-label={group.label ?? "Utama"} className="space-y-0.5">
            {group.label && !collapsed ? (
              <p className="px-2 pb-1 text-[11px] font-medium text-subtle">{group.label}</p>
            ) : null}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                collapsed={collapsed}
                badge={item.href === "/notifications" ? unreadCount : undefined}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        ))}

        <div className="space-y-0.5">
          {collapsed ? null : <p className="px-2 pb-1 text-[11px] font-medium text-subtle">Proyek</p>}
          {projects.map((p) => {
            const href = `/projects/${p.id}`;
            const active = isActive(href);
            const link = (
              <Link
                key={p.id}
                href={href}
                onClick={onNavigate}
                aria-label={collapsed ? p.name : undefined}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md text-[13px] transition-colors",
                  collapsed ? "justify-center" : "px-2",
                  active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
                )}
              >
                <ProjectIcon icon={p.icon} color={p.color} size="sm" />
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
          {projectTotal > projects.length && !collapsed ? (
            <Link
              href="/projects"
              onClick={onNavigate}
              className="flex h-7 items-center rounded-md px-2 text-[12px] text-subtle hover:bg-hover hover:text-fg"
            >
              Lihat semua ({projectTotal})
            </Link>
          ) : null}
          <NewProjectDialog
            trigger={(open) => (
              <Tooltip content="Proyek baru" side="right" disabled={!collapsed}>
                <button
                  type="button"
                  onClick={open}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md text-[13px] text-subtle hover:bg-hover hover:text-fg",
                    collapsed ? "justify-center" : "px-2",
                  )}
                  aria-label="Proyek baru"
                >
                  <span className="flex h-5 w-5 items-center justify-center">
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {collapsed ? null : "Proyek baru"}
                </button>
              </Tooltip>
            )}
          />
        </div>
      </div>

      <div className={cn("shrink-0 space-y-2 border-t border-border py-3", pad)}>
        <ActiveTimerCard collapsed={collapsed} />
        <nav aria-label="Akun" className="space-y-0.5">
          {[...BOTTOM_ITEMS, ...(user.isAdmin ? [{ href: "/admin/users", label: "Kelola pengguna", icon: ShieldCheck }] : [])].map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
          <Tooltip content="Keluar" side="right" disabled={!collapsed}>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              aria-label={collapsed ? "Keluar" : undefined}
              className={cn(
                "flex h-8 w-full items-center gap-2.5 rounded-md text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg",
                collapsed ? "justify-center" : "px-2",
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              {collapsed ? null : "Keluar"}
            </button>
          </Tooltip>
        </nav>
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "px-1")}>
          <Tooltip content={`${user.name} · @${user.username}`} side="right" disabled={!collapsed}>
            <Link
              href="/profile"
              onClick={onNavigate}
              className={cn("flex min-w-0 items-center gap-2.5 rounded-md hover:bg-hover", collapsed ? "p-1" : "flex-1 px-1 py-1")}
              aria-label={collapsed ? `Profil ${user.name}` : undefined}
            >
              <Avatar name={user.name} src={user.avatar} size="sm" />
              {collapsed ? null : (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{user.name}</span>
                  <span className="block truncate text-[11px] text-muted">@{user.username}</span>
                </span>
              )}
            </Link>
          </Tooltip>
          {collapsed ? null : <ThemeToggle />}
        </div>
      </div>
    </div>
  );
}
