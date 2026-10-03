"use client";

import { useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PROJECT_COLOR_LABEL, PROJECT_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS, PROJECT_ICONS, type Project, type ProjectColor, type ProjectIcon as IconKey } from "@/types/project";
import type { FieldErrors } from "@/types/action";
import { PROJECT_COLOR_SWATCH, PROJECT_ICON_MAP, ProjectIcon } from "./project-icon";

function suggestKey(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const key = words.length === 1 ? (words[0] ?? "").slice(0, 4) : words.map((w) => w[0]).join("").slice(0, 4);
  return /^[A-Z]/.test(key) ? key.padEnd(2, "X") : `P${key}`.slice(0, 4);
}

/** Shared fields for creating and editing a project. Archiving is a separate action. */
export function ProjectFormFields({ initial, errors }: { initial?: Partial<Project>; errors: FieldErrors }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(initial?.key));
  const [icon, setIcon] = useState<IconKey>(initial?.icon ?? "folder");
  const [color, setColor] = useState<ProjectColor>(initial?.color ?? "blue");
  const statuses = Object.entries(PROJECT_STATUS_LABEL).filter(([value]) => value !== "ARCHIVED");

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <ProjectIcon icon={icon} color={color} size="lg" className="mt-6" />
        <div className="grid flex-1 gap-4 sm:grid-cols-[1fr_110px]">
          <Field label="Nama proyek" htmlFor="project-name" error={errors.name}>
            <Input
              id="project-name"
              name="name"
              value={name}
              required
              maxLength={80}
              autoFocus
              placeholder="Website Desa"
              aria-invalid={Boolean(errors.name)}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(suggestKey(e.target.value));
              }}
            />
          </Field>
          <Field label="Kode" htmlFor="project-key" error={errors.key} hint="Awalan nomor tugas">
            <Input
              id="project-key"
              name="key"
              value={key}
              required
              maxLength={6}
              placeholder="WEB"
              className="font-mono uppercase"
              aria-invalid={Boolean(errors.key)}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              }}
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Ikon</legend>
          <input type="hidden" name="icon" value={icon} />
          <div className="flex flex-wrap gap-1">
            {PROJECT_ICONS.map((value) => {
              const Icon = PROJECT_ICON_MAP[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setIcon(value)}
                  aria-label={`Ikon ${value}`}
                  aria-pressed={icon === value}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    icon === value ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover hover:text-fg",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Warna</legend>
          <input type="hidden" name="color" value={color} />
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                aria-label={PROJECT_COLOR_LABEL[value]}
                aria-pressed={color === value}
                className={cn(
                  "h-6 w-6 rounded-full ring-offset-2 ring-offset-surface transition",
                  PROJECT_COLOR_SWATCH[value],
                  color === value ? "ring-2 ring-fg" : "opacity-80 hover:opacity-100",
                )}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <Field label="Deskripsi" htmlFor="project-description" error={errors.description}>
        <Textarea
          id="project-description"
          name="description"
          defaultValue={initial?.description ?? ""}
          maxLength={2000}
          placeholder="Apa tujuan proyek ini?"
          rows={3}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status" htmlFor="project-status" error={errors.status}>
          <Select id="project-status" name="status" defaultValue={initial?.status === "ARCHIVED" ? "ACTIVE" : (initial?.status ?? "ACTIVE")}>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tanggal mulai" htmlFor="project-start" error={errors.startDate}>
          <Input id="project-start" name="startDate" type="date" defaultValue={initial?.startDate ?? ""} />
        </Field>
        <Field label="Tenggat" htmlFor="project-due" error={errors.dueDate}>
          <Input id="project-due" name="dueDate" type="date" defaultValue={initial?.dueDate ?? ""} />
        </Field>
      </div>
    </div>
  );
}
