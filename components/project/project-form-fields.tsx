"use client";

import { useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { PROJECT_ICONS, type Project, type ProjectIcon as IconKey } from "@/types/project";
import type { FieldErrors } from "@/types/action";
import { PROJECT_ICON_MAP } from "./project-icon";


function suggestKey(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const key = words.length === 1 ? (words[0] ?? "").slice(0, 4) : words.map((w) => w[0]).join("").slice(0, 4);
  return /^[A-Z]/.test(key) ? key : `P${key}`.slice(0, 4);
}

/** Shared fields for creating and editing a project. Uncontrolled except name/key/icon. */
export function ProjectFormFields({
  initial,
  errors,
}: {
  initial?: Partial<Project>;
  errors: FieldErrors;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(initial?.key));
  const [icon, setIcon] = useState<IconKey>(initial?.icon ?? "folder");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Name" htmlFor="project-name" error={errors.name}>
          <Input
            id="project-name"
            name="name"
            value={name}
            required
            maxLength={80}
            autoFocus
            placeholder="Website redesign"
            aria-invalid={Boolean(errors.name)}
            onChange={(e) => {
              setName(e.target.value);
              if (!keyTouched) setKey(suggestKey(e.target.value));
            }}
          />
        </Field>
        <Field label="Key" htmlFor="project-key" error={errors.key}>
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

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">Icon</legend>
        <input type="hidden" name="icon" value={icon} />
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_ICONS.map((value) => {
            const Icon = PROJECT_ICON_MAP[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => setIcon(value)}
                aria-label={value}
                aria-pressed={icon === value}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                  icon === value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted hover:bg-hover hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Description" htmlFor="project-description" error={errors.description}>
        <Textarea
          id="project-description"
          name="description"
          defaultValue={initial?.description ?? ""}
          maxLength={2000}
          placeholder="What is this project about?"
          rows={3}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status" htmlFor="project-status" error={errors.status}>
          <Select id="project-status" name="status" defaultValue={initial?.status ?? "ACTIVE"}>
            {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" htmlFor="project-start" error={errors.startDate}>
          <Input id="project-start" name="startDate" type="date" defaultValue={initial?.startDate ?? ""} />
        </Field>
        <Field label="Target date" htmlFor="project-target" error={errors.targetDate}>
          <Input id="project-target" name="targetDate" type="date" defaultValue={initial?.targetDate ?? ""} />
        </Field>
      </div>
    </div>
  );
}
