"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import {
  Activity,
  Bell,
  Box,
  Boxes,
  CalendarDays,
  CheckSquare,
  CircleDot,
  FolderKanban,
  Home,
  Loader2,
  Search,
  Settings,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { searchAction, type SearchResult } from "@/app/actions/search/search-action";
import { Avatar } from "@/components/ui/avatar";
import { COMMAND_PALETTE_EVENT } from "./command-events";

const PAGES: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dasbor", href: "/dashboard", icon: Home },
  { label: "Tugas Saya", href: "/my-tasks", icon: CheckSquare },
  { label: "Proyek Saya", href: "/projects", icon: FolderKanban },
  { label: "Jadwal", href: "/calendar", icon: CalendarDays },
  { label: "Notifikasi", href: "/notifications", icon: Bell },
  { label: "Aktivitas", href: "/activity", icon: Activity },
  { label: "Profil", href: "/profile", icon: UserIcon },
  { label: "Pengaturan", href: "/settings", icon: Settings },
];

const KIND_ICON: Record<SearchResult["kind"], LucideIcon> = {
  project: FolderKanban,
  module: Boxes,
  submodule: Box,
  task: CircleDot,
  member: UserIcon,
};

const GROUP_LABEL: Record<SearchResult["kind"], string> = {
  project: "Proyek",
  module: "Modul",
  submodule: "Sub modul",
  task: "Tugas",
  member: "Anggota",
};

const itemClass =
  "flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] data-[selected=true]:bg-hover";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    const q = value.trim();
    const id = ++requestId.current;
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Debounce: only the latest request updates the list.
    window.setTimeout(async () => {
      if (id !== requestId.current) return;
      const res = await searchAction({ query: q });
      if (id !== requestId.current) return;
      setResults(res.ok ? res.data : []);
      setLoading(false);
    }, 200);
  }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  const groups = (["project", "module", "submodule", "task", "member"] as const)
    .map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/40" />
        <D.Content
          className="animate-pop-in fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-pop focus:outline-none"
          aria-describedby={undefined}
        >
          <D.Title className="sr-only">Pencarian</D.Title>
          <Command shouldFilter={false} label="Pencarian">
            <div className="flex items-center gap-2 border-b border-border px-3">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-subtle" aria-hidden />
              ) : (
                <Search className="h-4 w-4 text-subtle" aria-hidden />
              )}
              <Command.Input
                value={query}
                onValueChange={onQueryChange}
                placeholder="Cari proyek, modul, tugas, atau orang…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              />
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
              {query.trim().length < 2 ? (
                <Command.Group heading="Buka halaman" className="text-[11px] text-subtle [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5">
                  {PAGES.map(({ label, href, icon: Icon }) => (
                    <Command.Item key={href} value={href} onSelect={() => go(href)} className={itemClass}>
                      <Icon className="h-4 w-4 text-muted" aria-hidden />
                      <span className="text-fg">{label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : (
                <>
                  {!loading && groups.length === 0 ? (
                    <p className="px-3 py-8 text-center text-[13px] text-muted">Tidak ada hasil untuk “{query.trim()}”.</p>
                  ) : null}
                  {groups.map((group) => (
                    <Command.Group
                      key={group.kind}
                      heading={GROUP_LABEL[group.kind]}
                      className="text-[11px] text-subtle [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5"
                    >
                      {group.items.map((r) => {
                        const Icon = KIND_ICON[r.kind];
                        return (
                          <Command.Item
                            key={`${r.kind}-${r.id}`}
                            value={`${r.kind}-${r.id}`}
                            onSelect={() => go(r.href)}
                            className={itemClass}
                          >
                            {r.kind === "member" ? (
                              <Avatar name={r.title} src={r.avatar} size="xs" />
                            ) : (
                              <Icon className="h-4 w-4 text-muted" aria-hidden />
                            )}
                            <span className="min-w-0 flex-1 truncate text-fg">{r.title}</span>
                            <span className="shrink-0 truncate text-xs text-subtle">{r.subtitle}</span>
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  ))}
                </>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
