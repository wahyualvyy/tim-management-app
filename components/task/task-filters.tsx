"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import { PRIORITY_META, STATUS_META } from "./task-meta";

/** URL-driven filters, so filtered views can be shared and survive reloads. */
export function TaskFilters({
  modules,
  members,
}: {
  modules: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    next.delete("task");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const active = ["q", "status", "priority", "assignee", "module"].some((k) => params.get(k));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        className="relative w-full sm:w-64"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() });
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => q.trim() !== (params.get("q") ?? "") && apply({ q: q.trim() })}
          placeholder="Filter by title or label"
          className="pl-8"
          aria-label="Filter by text"
        />
      </form>
      <div className="w-[calc(50%-4px)] sm:w-36">
        <Select value={params.get("status") ?? ""} onChange={(e) => apply({ status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>
          <option value="open">Open</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[calc(50%-4px)] sm:w-36">
        <Select value={params.get("priority") ?? ""} onChange={(e) => apply({ priority: e.target.value })} aria-label="Priority">
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[calc(50%-4px)] sm:w-40">
        <Select value={params.get("assignee") ?? ""} onChange={(e) => apply({ assignee: e.target.value })} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[calc(50%-4px)] sm:w-40">
        <Select value={params.get("module") ?? ""} onChange={(e) => apply({ module: e.target.value })} aria-label="Module">
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
      {active ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            apply({ q: "", status: "", priority: "", assignee: "", module: "" });
          }}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-hover hover:text-fg"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Clear
        </button>
      ) : null}
    </div>
  );
}
