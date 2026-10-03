"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

export interface SelectableUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string | null;
  jobTitle: string;
}

/** Searchable single-select of people. Matches name, username, email and job title. */
export function UserSelect({
  id,
  users,
  value,
  onChange,
  invalid,
  placeholder = "Pilih orang…",
  emptyText = "Tidak ada orang yang cocok.",
}: {
  id?: string;
  users: SelectableUser[];
  value: string;
  onChange: (userId: string) => void;
  invalid?: boolean;
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.id === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          data-invalid={invalid || undefined}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 text-left text-sm",
            "hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-[invalid=true]:border-danger",
          )}
        >
          {selected ? (
            <>
              <Avatar name={selected.name} src={selected.avatar} size="xs" />
              <span className="min-w-0 flex-1 truncate">{selected.name}</span>
              <span className="hidden truncate text-xs text-subtle sm:inline">@{selected.username}</span>
            </>
          ) : (
            <span className="flex-1 truncate text-subtle">{placeholder}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="animate-pop-in z-50 w-[var(--radix-popover-trigger-width)] min-w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
        >
          <Command label="Cari orang">
            <div className="flex items-center gap-2 border-b border-border px-2.5">
              <Search className="h-3.5 w-3.5 text-subtle" aria-hidden />
              <Command.Input
                autoFocus
                placeholder="Cari nama, username, atau email…"
                className="h-9 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle focus-visible:outline-none"
              />
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-4 text-center text-xs text-muted">{emptyText}</Command.Empty>
              {users.map((u) => (
                <Command.Item
                  key={u.id}
                  value={`${u.name} ${u.username} ${u.email} ${u.jobTitle} ${u.id}`}
                  onSelect={() => {
                    onChange(u.id);
                    setOpen(false);
                  }}
                  className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] data-[selected=true]:bg-hover"
                >
                  <Avatar name={u.name} src={u.avatar} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{u.name}</span>
                    <span className="block truncate text-[11px] text-subtle">
                      @{u.username} · {u.email}
                    </span>
                  </span>
                  {u.id === value ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden /> : null}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
