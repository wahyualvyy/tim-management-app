"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createTaskAction } from "@/app/actions/task/create-task";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { AssigneePicker } from "@/components/people/person-pickers";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import { createTaskSchema } from "@/schemas/task.schema";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from "@/types/task";
import type { CreateTaskContext, PersonOption } from "@/types/views";
import { useOpenTask } from "./use-open-task";

export interface TaskDefaults {
  moduleId?: string;
  subModuleId?: string | null;
  status?: TaskStatus;
}

/** Module then sub module, as two dependent selects. */
export function PlacementFields({
  context,
  moduleId,
  subModuleId,
  onChange,
  errors,
}: {
  context: Pick<CreateTaskContext, "structure">;
  moduleId: string;
  subModuleId: string;
  onChange: (moduleId: string, subModuleId: string) => void;
  errors?: { moduleId?: string[]; subModuleId?: string[] };
}) {
  const mod = context.structure.find((m) => m.id === moduleId);
  return (
    <>
      <Field label="Modul" htmlFor="task-module" error={errors?.moduleId}>
        <Select id="task-module" name="moduleId" value={moduleId} onChange={(e) => onChange(e.target.value, "")}>
          {context.structure.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Sub modul" htmlFor="task-submodule" error={errors?.subModuleId}>
        <Select id="task-submodule" name="subModuleId" value={subModuleId} onChange={(e) => onChange(moduleId, e.target.value)}>
          <option value="">Langsung di modul</option>
          {(mod?.subModules ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  context,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: CreateTaskContext;
  defaults?: TaskDefaults;
}) {
  const { open: openTask } = useOpenTask();
  const { run, pending, fieldErrors } = useAction(createTaskAction, {
    schema: createTaskSchema,
    successMessage: "Tugas berhasil dibuat.",
    onSuccess: ({ taskId }) => {
      onOpenChange(false);
      openTask(taskId);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tugas baru"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant="primary" type="submit" form="create-task-form" loading={pending}>
            Buat tugas
          </Button>
        </>
      }
    >
      {open ? (
        <CreateTaskForm
          context={context}
          defaults={defaults}
          errors={fieldErrors}
          onSubmit={(fd) => {
            fd.set("projectId", context.projectId);
            void run(fd);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function CreateTaskForm({
  context,
  defaults,
  errors,
  onSubmit,
}: {
  context: CreateTaskContext;
  defaults?: TaskDefaults;
  errors: Record<string, string[] | undefined>;
  onSubmit: (fd: FormData) => void;
}) {
  const [moduleId, setModuleId] = useState(defaults?.moduleId ?? context.structure[0]?.id ?? "");
  const [subModuleId, setSubModuleId] = useState(
    defaults?.subModuleId !== undefined ? (defaults.subModuleId ?? "") : (context.structure.find((m) => m.id === (defaults?.moduleId ?? context.structure[0]?.id))?.subModules[0]?.id ?? ""),
  );
  const [assignees, setAssignees] = useState<PersonOption[]>([]);
  const self: PersonOption = { id: context.viewerId, name: context.viewerName, username: "", avatar: context.viewerAvatar, jobTitle: "" };

  return (
    <form
      id="create-task-form"
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <Field label="Judul" htmlFor="task-title" error={errors.title}>
        <Input id="task-title" name="title" required maxLength={200} autoFocus placeholder="Apa yang perlu dikerjakan?" />
      </Field>
      <Field label="Deskripsi" htmlFor="task-description" error={errors.description}>
        <Textarea id="task-description" name="description" rows={3} maxLength={10000} placeholder="Detail, kriteria selesai, atau tautan (opsional)" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <PlacementFields
          context={context}
          moduleId={moduleId}
          subModuleId={subModuleId}
          errors={errors}
          onChange={(m, s) => {
            setModuleId(m);
            setSubModuleId(s);
          }}
        />
        <Field label="Status" htmlFor="task-status">
          <Select id="task-status" name="status" defaultValue={defaults?.status ?? "TODO"}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioritas" htmlFor="task-priority">
          <Select id="task-priority" name="priority" defaultValue="MEDIUM">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-1.5 sm:col-span-2">
          <span className="block text-[13px] font-medium">Penanggung jawab</span>
          <AssigneePicker
            projectId={context.projectId}
            name="assigneeIds"
            selected={assignees}
            onChange={setAssignees}
            allowOthers={context.canAssignOthers}
            self={self}
          />
          {errors.assigneeIds?.[0] ? <p className="text-xs text-danger">{errors.assigneeIds[0]}</p> : null}
        </div>
        <Field label="Tanggal mulai" htmlFor="task-start" error={errors.startDate}>
          <Input id="task-start" name="startDate" type="date" />
        </Field>
        <Field label="Tenggat" htmlFor="task-due" error={errors.dueDate}>
          <Input id="task-due" name="dueDate" type="date" />
        </Field>
        <Field label="Estimasi (menit)" htmlFor="task-estimate" error={errors.estimatedMinutes}>
          <Input id="task-estimate" name="estimatedMinutes" type="number" min={1} placeholder="Opsional" />
        </Field>
        <Field label="Label" htmlFor="task-labels" error={errors.labels} hint="Pisahkan dengan koma">
          <Input id="task-labels" name="labels" placeholder="frontend, bug" />
        </Field>
      </div>
    </form>
  );
}

export function CreateTaskButton({
  context,
  defaults,
  variant = "primary",
  label = "Tugas baru",
}: {
  context: CreateTaskContext;
  defaults?: TaskDefaults;
  variant?: "primary" | "ghost" | "outline";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={variant === "ghost" ? "sm" : "md"} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      <CreateTaskDialog open={open} onOpenChange={setOpen} context={context} defaults={defaults} />
    </>
  );
}
