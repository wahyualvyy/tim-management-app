"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Check, Loader2, Search } from "lucide-react";
import { useDebounced } from "@/components/hooks/use-debounced";
import { Avatar } from "@/components/ui/avatar";
import type { ActionResult } from "@/types/action";
import type { PersonOption } from "@/types/views";

export type PersonFetcher<P extends PersonOption = PersonOption> = (query: string) => Promise<ActionResult<P[]>>;

/**
 * A popover that searches people on the server as the user types (debounced
 * 300 ms). Only one page of results is ever loaded, so it works the same for
 * 10 or 100 000 people.
 */
export function PersonSearchPopover<P extends PersonOption>({
  trigger,
  fetcher,
  isSelected,
  onPick,
  minQuery = 0,
  emptyText = "Tidak ada orang yang cocok.",
  hint,
  closeOnPick = true,
}: {
  trigger: ReactNode;
  fetcher: PersonFetcher<P>;
  isSelected: (id: string) => boolean;
  onPick: (person: P) => void;
  minQuery?: number;
  emptyText?: string;
  hint?: string;
  closeOnPick?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 300);
  const [state, setState] = useState<{ key: string; results: P[]; error: string | null } | null>(null);
  const requestKey = open && debounced.length >= minQuery ? debounced : null;

  useEffect(() => {
    if (requestKey === null) return;
    let cancelled = false;
    fetcher(requestKey)
      .then((res) => {
        if (!cancelled) setState({ key: requestKey, results: res.ok ? res.data : [], error: res.ok ? null : res.error });
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestKey, results: [], error: "Gagal memuat. Coba lagi." });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, fetcher]);

  const loading = requestKey !== null && state?.key !== requestKey;
  const results = state?.key === requestKey ? state.results : [];

  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="animate-pop-in z-50 w-[var(--radix-popover-trigger-width)] min-w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
        >
          <div className="flex items-center gap-2 border-b border-border px-2.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle" aria-hidden /> : <Search className="h-3.5 w-3.5 text-subtle" aria-hidden />}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, username, atau email…"
              aria-label="Cari orang"
              className="h-9 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle focus-visible:outline-none"
            />
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto p-1">
            {requestKey === null ? (
              <p className="px-2 py-4 text-center text-xs text-muted">{hint ?? `Ketik minimal ${minQuery} huruf.`}</p>
            ) : state?.error && state.key === requestKey ? (
              <p className="px-2 py-4 text-center text-xs text-danger">{state.error}</p>
            ) : !loading && results.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted">{emptyText}</p>
            ) : (
              results.map((p) => {
                const selected = isSelected(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onPick(p);
                      if (closeOnPick) setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover focus:bg-hover focus:outline-none"
                  >
                    <Avatar name={p.name} src={p.avatar} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{p.name}</span>
                      <span className="block truncate text-[11px] text-subtle">
                        @{p.username}
                        {p.jobTitle ? ` · ${p.jobTitle}` : ""}
                      </span>
                    </span>
                    {selected ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden /> : null}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
