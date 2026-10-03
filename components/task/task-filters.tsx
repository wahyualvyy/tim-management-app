"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { MemberSelect } from "@/components/people/person-pickers";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import type { PersonOption } from "@/types/views";

/** URL-driven filters, so filtered views can be shared and survive reloads. */
export function TaskFilters({
  projectId,
  modules,
  selectedAssignee,
}: {
  projectId: string;
  modules: { id: string; name: string }[];
  /** The person in the assignee filter, resolved on the server. */
  selectedAssignee: PersonOption | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();
  const unassigned = params.get("assignee") === "none";

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    next.delete("after");
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
          placeholder="Cari judul, kode, atau label"
          className="pl-8"
          aria-label="Cari tugas"
        />
      </form>
      <div className="w-[calc(50%-4px)] sm:w-36">
        <Select value={params.get("status") ?? ""} onChange={(e) => apply({ status: e.target.value })} aria-label="Status">
          <option value="">Semua status</option>
          <option value="open">Belum selesai</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[calc(50%-4px)] sm:w-36">
        <Select value={params.get("priority") ?? ""} onChange={(e) => apply({ priority: e.target.value })} aria-label="Prioritas">
          <option value="">Semua prioritas</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-full items-center gap-1 sm:w-56">
        {unassigned ? (
          <button
            type="button"
            onClick={() => apply({ assignee: "" })}
            className="flex h-8 flex-1 items-center justify-between rounded-md border border-border bg-surface px-2 text-sm"
            aria-label="Hapus filter belum ditugaskan"
          >
            Belum ditugaskan <X className="h-3.5 w-3.5 text-subtle" aria-hidden />
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <MemberSelect
              projectId={projectId}
              value={selectedAssignee}
              onChange={(p) => apply({ assignee: p?.id ?? "" })}
              placeholder="Semua orang"
              noneLabel="Hapus filter orang"
            />
          </div>
        )}
        {params.get("assignee") ? null : (
          <button
            type="button"
            onClick={() => apply({ assignee: "none" })}
            className="h-8 shrink-0 rounded-md px-2 text-xs text-muted hover:bg-hover hover:text-fg"
            title="Tampilkan tugas tanpa penanggung jawab"
          >
            Tanpa PJ
          </button>
        )}
      </div>
      <div className="w-[calc(50%-4px)] sm:w-40">
        <Select value={params.get("module") ?? ""} onChange={(e) => apply({ module: e.target.value })} aria-label="Modul">
          <option value="">Semua modul</option>
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
          Hapus filter
        </button>
      ) : null}
    </div>
  );
}
