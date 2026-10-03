"use client";

import { useCallback } from "react";
import { ChevronDown, UserPlus, X } from "lucide-react";
import { searchProjectMembersAction } from "@/app/actions/query/query-actions";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { PersonOption } from "@/types/views";
import { PersonSearchPopover } from "./person-search";

const triggerClass =
  "flex min-h-8 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-left text-sm hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

function useMemberFetcher(projectId: string, workersOnly: boolean) {
  return useCallback((query: string) => searchProjectMembersAction({ projectId, query, workersOnly }), [projectId, workersOnly]);
}

/**
 * Multi-select of project members for task assignees. Searches the project's
 * member index on the server; `selected` carries the people already chosen so
 * they can be shown without loading the whole member list.
 */
export function AssigneePicker({
  projectId,
  selected,
  onChange,
  disabled,
  name,
  allowOthers = true,
  self,
}: {
  projectId: string;
  selected: PersonOption[];
  onChange: (people: PersonOption[]) => void;
  disabled?: boolean;
  /** Renders hidden inputs with this name so the picker works in plain forms. */
  name?: string;
  /** Members may only assign themselves. */
  allowOthers?: boolean;
  self: PersonOption;
}) {
  const fetcher = useMemberFetcher(projectId, true);
  const ids = new Set(selected.map((p) => p.id));
  const toggle = (person: PersonOption) => onChange(ids.has(person.id) ? selected.filter((p) => p.id !== person.id) : [...selected, person]);

  return (
    <div>
      {name ? selected.map((p) => <input key={p.id} type="hidden" name={name} value={p.id} />) : null}
      {allowOthers ? (
        <PersonSearchPopover
          fetcher={fetcher}
          isSelected={(id) => ids.has(id)}
          onPick={toggle}
          closeOnPick={false}
          hint="Ketik untuk mencari anggota."
          trigger={
            <button type="button" disabled={disabled} className={triggerClass} aria-label="Penanggung jawab">
              <SelectedChips selected={selected} onRemove={disabled ? undefined : (p) => toggle(p)} />
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
            </button>
          }
        />
      ) : (
        <div className={cn(triggerClass, "cursor-default")}>
          <SelectedChips selected={selected} onRemove={disabled ? undefined : (p) => (p.id === self.id ? toggle(p) : undefined)} />
          {!disabled && !ids.has(self.id) ? (
            <button type="button" onClick={() => toggle(self)} className="shrink-0 rounded-md px-1.5 text-xs text-accent hover:bg-hover">
              Tugaskan saya
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SelectedChips({ selected, onRemove }: { selected: PersonOption[]; onRemove?: (p: PersonOption) => void }) {
  if (selected.length === 0) {
    return (
      <span className="flex flex-1 items-center gap-1.5 text-subtle">
        <UserPlus className="h-3.5 w-3.5" aria-hidden />
        Belum ditugaskan
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {selected.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pl-0.5 pr-1 text-xs">
          <Avatar name={p.name} src={p.avatar} size="xs" />
          <span className="max-w-28 truncate">{p.name}</span>
          {onRemove ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Lepas ${p.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(p);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(p);
                }
              }}
              className="rounded p-0.5 text-subtle hover:text-fg"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

/** Single member select (module leads, assignee filter). Empty value = none. */
export function MemberSelect({
  projectId,
  value,
  onChange,
  placeholder = "Pilih anggota…",
  noneLabel = "Tidak ada",
  workersOnly = true,
  id,
}: {
  projectId: string;
  value: PersonOption | null;
  onChange: (person: PersonOption | null) => void;
  placeholder?: string;
  noneLabel?: string;
  workersOnly?: boolean;
  id?: string;
}) {
  const fetcher = useMemberFetcher(projectId, workersOnly);
  return (
    <div className="flex items-center gap-1">
      <PersonSearchPopover
        fetcher={fetcher}
        isSelected={(pid) => value?.id === pid}
        onPick={onChange}
        hint="Ketik untuk mencari anggota."
        trigger={
          <button id={id} type="button" className={triggerClass}>
            {value ? (
              <>
                <Avatar name={value.name} src={value.avatar} size="xs" />
                <span className="min-w-0 flex-1 truncate">{value.name}</span>
              </>
            ) : (
              <span className="flex-1 truncate text-subtle">{placeholder}</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
          </button>
        }
      />
      {value ? (
        <button type="button" onClick={() => onChange(null)} className="rounded-md p-1.5 text-subtle hover:bg-hover hover:text-fg" aria-label={noneLabel}>
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
