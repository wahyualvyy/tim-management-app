"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createTaskAction } from "@/app/actions/task/create-task";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from "@/types/task";
import { PRIORITY_META, STATUS_META } from "./task-meta";
import { useOpenTask } from "./use-open-task";
import type { CreateTaskContext } from "@/types/views";

export function CreateTaskButton({
  context,
  defaultModuleId,
  defaultStatus = "TODO",
  variant = "primary",
  label = "New task",
}: {
  context: CreateTaskContext;
  defaultModuleId?: string;
  defaultStatus?: TaskStatus;
  variant?: "primary" | "ghost" | "outline";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { open: openTask } = useOpenTask();
  const { run, pending, fieldErrors } = useAction(createTaskAction, {
    successMessage: "Task created",
    onSuccess: ({ taskId }) => {
      setOpen(false);
      openTask(taskId);
    },
  });

  if (context.modules.length === 0) return null;

  return (
    <>
      <Button
        variant={variant}
        size={variant === "ghost" ? "sm" : "md"}
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New task"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="create-task-form" loading={pending}>
              Create task
            </Button>
          </>
        }
      >
        <form
          id="create-task-form"
          key={formKey}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("projectId", context.projectId);
            void run(fd);
          }}
        >
          <Field label="Title" htmlFor="task-title" error={fieldErrors.title}>
            <Input id="task-title" name="title" required maxLength={200} autoFocus placeholder="What needs to be done?" />
          </Field>
          <Field label="Description" htmlFor="task-description" error={fieldErrors.description}>
            <Textarea id="task-description" name="description" rows={3} maxLength={10000} placeholder="Optional details" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Module" htmlFor="task-module" error={fieldErrors.moduleId}>
              <Select id="task-module" name="moduleId" defaultValue={defaultModuleId ?? context.modules[0]?.id}>
                {context.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assignee" htmlFor="task-assignee" error={fieldErrors.assigneeId}>
              <Select id="task-assignee" name="assigneeId" defaultValue="">
                <option value="">Unassigned</option>
                {context.assignees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === context.viewerId ? `${m.name} (you)` : m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="task-status">
              <Select id="task-status" name="status" defaultValue={defaultStatus}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="task-priority">
              <Select id="task-priority" name="priority" defaultValue="NONE">
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start date" htmlFor="task-start" error={fieldErrors.startDate}>
              <Input id="task-start" name="startDate" type="date" />
            </Field>
            <Field label="Due date" htmlFor="task-due" error={fieldErrors.dueDate}>
              <Input id="task-due" name="dueDate" type="date" />
            </Field>
            <Field label="Estimate (minutes)" htmlFor="task-estimate" error={fieldErrors.estimateMinutes}>
              <Input id="task-estimate" name="estimateMinutes" type="number" min={1} placeholder="Optional" />
            </Field>
            <Field label="Labels" htmlFor="task-labels" error={fieldErrors.labels} hint="Comma separated">
              <Input id="task-labels" name="labels" placeholder="frontend, bug" />
            </Field>
          </div>
        </form>
      </Dialog>
    </>
  );
}
