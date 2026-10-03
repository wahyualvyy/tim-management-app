"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId, showSettings }: { projectId: string; showSettings: boolean }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/board`, label: "Board" },
    { href: `${base}/modules`, label: "Modules" },
    { href: `${base}/tasks`, label: "Tasks" },
    { href: `${base}/activity`, label: "Activity" },
    { href: `${base}/members`, label: "Members" },
    ...(showSettings ? [{ href: `${base}/settings`, label: "Settings" }] : []),
  ];
  return (
    <nav className="scroll-thin -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0" aria-label="Project">
      <div className="flex min-w-max gap-5">
        {tabs.map((tab) => {
          const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 pb-2.5 text-[13px] transition-colors",
                active ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
