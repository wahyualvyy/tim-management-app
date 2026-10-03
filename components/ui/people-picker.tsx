"use client";

import { Popover } from "radix-ui";
import { Check, ChevronDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

export interface PickerPerson {
  id: string;
  name: string;
  avatar?: string | null;
}

/** Multi-select for assignees. Renders hidden inputs so it works inside plain forms. */
export function PeoplePicker({
  people,
  value,
  onChange,
  name,
  disabled,
  placeholder = "Belum ditugaskan",
  label = "Penanggung jawab",
}: {
  people: PickerPerson[];
  value: string[];
  onChange: (next: string[]) => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const selected = people.filter((p) => value.includes(p.id));
  // Keep selections of people not offered (e.g. someone else on a member's task) visible.
  const unknown = value.filter((id) => !people.some((p) => p.id === id));

  return (
    <Popover.Root>
      {name ? value.map((id) => <input key={id} type="hidden" name={name} value={id} />) : null}
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "flex min-h-8 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-left text-sm",
            "hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {selected.length === 0 && unknown.length === 0 ? (
            <span className="flex flex-1 items-center gap-1.5 text-subtle">
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              {placeholder}
            </span>
          ) : (
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {selected.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pl-0.5 pr-1.5 text-xs">
                  <Avatar name={p.name} src={p.avatar} size="xs" />
                  <span className="max-w-28 truncate">{p.name}</span>
                </span>
              ))}
              {unknown.length > 0 ? <span className="text-xs text-muted">+{unknown.length} lainnya</span> : null}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="animate-pop-in z-50 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-pop"
        >
          {people.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted">Tidak ada orang yang dapat dipilih.</p>
          ) : (
            people.map((p) => {
              const checked = value.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  onClick={() => onChange(checked ? value.filter((id) => id !== p.id) : [...value, p.id])}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover focus:bg-hover focus:outline-none"
                >
                  <Avatar name={p.name} src={p.avatar} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {checked ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden /> : null}
                </button>
              );
            })
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
