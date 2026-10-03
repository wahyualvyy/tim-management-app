"use client";

import { useState, type ReactNode } from "react";
import { Dialog as D } from "radix-ui";
import { Menu as MenuIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { openCommandPalette } from "./command-events";
import { LogoMark } from "./logo";
import { SidebarContent, type SidebarProps } from "./sidebar";

export const SIDEBAR_COOKIE = "tim_sidebar";

export function AppShell({
  children,
  initialCollapsed,
  ...sidebar
}: Omit<SidebarProps, "collapsed" | "onToggleCollapsed" | "onNavigate"> & {
  children: ReactNode;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface transition-[width] duration-200 lg:block",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <SidebarContent {...sidebar} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <D.Portal>
          <D.Overlay className="animate-fade-in fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <D.Content
            className="animate-slide-in-right fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-surface shadow-pop focus:outline-none lg:hidden"
            aria-describedby={undefined}
          >
            <D.Title className="sr-only">Navigation</D.Title>
            <SidebarContent {...sidebar} collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg"
            aria-label="Open navigation"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <LogoMark className="h-6 w-6" />
          <div className="flex-1" />
          <button
            type="button"
            onClick={openCommandPalette}
            className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>
    </div>
  );
}
