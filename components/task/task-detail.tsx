"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight, Link2, MoreHorizontal, Play, Square, Trash2, X } from "lucide-react";
import { updateTaskAction } from "@/app/actions/task/update-task";
import { completeTaskAction, setTaskStatusAction } from "@/app/actions/task/set-task-status";
import { deleteTaskAction } from "@/app/actions/task/delete-task";
import { useAction } from "@/components/hooks/use-action";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, SheetClose } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Badge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ElapsedClock } from "@/components/timer/timer-display";
import { useTimer } from "@/components/timer/timer-provider";
import { formatDuration, formatLongDate } from "@/lib/dates";
import { cn, taskRef } from "@/lib/utils";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import type { TaskDetail } from "@/types/task-detail";
import { PRIORITY_META, STATUS_META, StatusIcon } from "./task-meta";
import { TaskActivityList, TaskAttachments, TaskComments, TaskTimeLogs } from "./task-detail-sections";

type Tab = "comments" | "time" | "activity";

export function TaskDetailView({
  detail,
  timeZone,
  today,
  onChanged,
  onDeleted,
}: {
  detail: TaskDetail;
  timeZone: string;
  today: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { task, project, permissions: can } = detail;
  const ref = taskRef(project.key, task.number);
  const toast = useToast();
  const timer = useTimer();
  const [tab, setTab] = useState<Tab>("comments");
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [labelsDraft, setLabelsDraft] = useState<string | null>(null);

  const update = useAction(updateTaskAction, { onSuccess: onChanged });
  const status = useAction(setTaskStatusAction, { onSuccess: onChanged });
  const complete = useAction(completeTaskAction, {
    onSuccess: () => {
      setCompleteOpen(false);
      onChanged();
    },
    successMessage: "Task completed",
  });
  const remove = useAction(deleteTaskAction, { onSuccess: onDeleted, successMessage: "Task deleted" });

  const save = (patch: Record<string, unknown>) => void update.run({ taskId: task.id, ...patch });
  const running = timer.timer?.taskId === task.id;
  const assignees = can.assignOthers ? detail.members.filter((m) => m.role !== "VIEWER") : detail.members.filter((m) => m.id === detail.viewerId);
  const currentModule = detail.modules.find((m) => m.id === task.moduleId);

  function commitTitle() {
    const value = titleDraft?.trim();
    setTitleDraft(null);
    if (value && value !== task.title) save({ title: value });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted" aria-label="Breadcrumb">
          <Link href={`/projects/${project.id}`} className="truncate hover:text-fg">
            {project.name}
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <Link href={`/projects/${project.id}/modules#module-${task.moduleId}`} className="truncate hover:text-fg">
            {currentModule?.name ?? "Module"}
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <span className="shrink-0 whitespace-nowrap font-mono text-fg">{ref}</span>
        </nav>
        {can.trackTime ? (
          running && timer.timer ? (
            <Button size="sm" variant="primary" onClick={timer.stop} disabled={timer.pending}>
              <Square className="h-3 w-3 fill-current" aria-hidden />
              <ElapsedClock startedAt={timer.timer.startedAt} />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={timer.pending}
              onClick={() => timer.start({ taskId: task.id, projectId: project.id, taskTitle: task.title, taskRef: ref })}
            >
              <Play className="h-3 w-3 fill-current" aria-hidden />
              Start timer
            </Button>
          )
        ) : null}
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              onSelect={() => {
                void navigator.clipboard
                  .writeText(`${window.location.origin}/projects/${project.id}/board?task=${task.id}`)
                  .then(() => toast.success("Link copied"));
              }}
            >
              <Link2 className="h-4 w-4 text-muted" aria-hidden /> Copy link
            </MenuItem>
            {can.delete ? (
              <>
                <MenuSeparator />
                <MenuItem danger onSelect={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete task
                </MenuItem>
              </>
            ) : null}
          </MenuContent>
        </Menu>
        <SheetClose className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg" aria-label="Close">
          <X className="h-4 w-4" />
        </SheetClose>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-5 py-5 md:grid-cols-[1fr_220px]">
          {/* Main column */}
          <div className="min-w-0 space-y-5">
            {project.archived ? (
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
                This project is archived. Tasks are read-only.
              </p>
            ) : null}
            {can.edit ? (
              <textarea
                value={titleDraft ?? task.title}
                onChange={(e) => setTitleDraft(e.target.value.replace(/\n/g, ""))}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") setTitleDraft(null);
                }}
                rows={1}
                maxLength={200}
                aria-label="Title"
                className="field-sizing-content w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-lg font-semibold leading-snug -mx-1 hover:bg-hover focus:bg-surface-2 focus:outline-none"
              />
            ) : (
              <h2 className="text-lg font-semibold leading-snug">{task.title}</h2>
            )}

            <section aria-label="Description">
              {can.edit && descDraft !== null ? (
                <div className="space-y-2">
                  <Textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={6}
                    autoFocus
                    maxLength={10000}
                    placeholder="Add details, acceptance criteria or links…"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDescDraft(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={update.pending}
                      onClick={() => {
                        save({ description: descDraft });
                        setDescDraft(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!can.edit}
                  onClick={() => setDescDraft(task.description)}
                  className={cn(
                    "block w-full rounded-md px-2 py-1.5 -mx-2 text-left text-sm leading-relaxed",
                    can.edit && "hover:bg-hover",
                  )}
                >
                  {task.description ? (
                    <span className="whitespace-pre-wrap break-words">{task.description}</span>
                  ) : (
                    <span className="text-subtle">{can.edit ? "Add a description…" : "No description."}</span>
                  )}
                </button>
              )}
            </section>

            {task.status === "DONE" ? (
              <section className="rounded-lg border border-success/25 bg-success-soft px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-success">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Completed{task.completedAt ? ` ${formatLongDate(task.completedAt, timeZone)}` : ""}
                </p>
                {task.completionNotes ? (
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-fg">{task.completionNotes}</p>
                ) : null}
              </section>
            ) : can.edit ? (
              <Button variant="outline" size="sm" onClick={() => setCompleteOpen(true)}>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Mark complete
              </Button>
            ) : null}

            <TaskAttachments detail={detail} onChanged={onChanged} />

            <div>
              <div className="flex gap-4 border-b border-border" role="tablist">
                {(
                  [
                    ["comments", `Comments${detail.comments.length ? ` ${detail.comments.length}` : ""}`],
                    ["time", "Time"],
                    ["activity", "Activity"],
                  ] as [Tab, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    className={cn(
                      "-mb-px border-b-2 pb-2 text-[13px] transition-colors",
                      tab === value ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="pt-4">
                {tab === "comments" ? <TaskComments detail={detail} timeZone={timeZone} onChanged={onChanged} /> : null}
                {tab === "time" ? (
                  <TaskTimeLogs detail={detail} timeZone={timeZone} today={today} onChanged={onChanged} />
                ) : null}
                {tab === "activity" ? <TaskActivityList detail={detail} timeZone={timeZone} /> : null}
              </div>
            </div>
          </div>

          {/* Properties */}
          <aside className="space-y-1 md:border-l md:border-border md:pl-5" aria-label="Properties">
            <Property label="Status">
              <Select
                value={task.status}
                disabled={!can.edit || status.pending}
                onChange={(e) => {
                  const value = e.target.value as (typeof TASK_STATUSES)[number];
                  if (value === "DONE") setCompleteOpen(true);
                  else void status.run({ taskId: task.id, status: value });
                }}
                aria-label="Status"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Property>
            <Property label="Priority">
              <Select
                value={task.priority}
                disabled={!can.edit}
                onChange={(e) => save({ priority: e.target.value })}
                aria-label="Priority"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </Select>
            </Property>
            <Property label="Assignee">
              <Select
                value={task.assigneeId ?? ""}
                disabled={!can.edit}
                onChange={(e) => save({ assigneeId: e.target.value })}
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {task.assigneeId && !assignees.some((m) => m.id === task.assigneeId) ? (
                  <option value={task.assigneeId}>{detail.users[task.assigneeId]?.name ?? "Unknown"}</option>
                ) : null}
                {assignees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Property>
            <Property label="Module">
              <Select
                value={task.moduleId}
                disabled={!can.edit}
                onChange={(e) => save({ moduleId: e.target.value })}
                aria-label="Module"
              >
                {detail.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Property>
            <Property label="Start date">
              <Input
                type="date"
                value={task.startDate ?? ""}
                disabled={!can.edit}
                onChange={(e) => save({ startDate: e.target.value })}
                aria-label="Start date"
              />
            </Property>
            <Property label="Due date">
              <Input
                type="date"
                value={task.dueDate ?? ""}
                disabled={!can.edit}
                onChange={(e) => save({ dueDate: e.target.value })}
                aria-label="Due date"
                className={cn(task.dueDate && task.status !== "DONE" && task.dueDate < today && "text-danger")}
              />
            </Property>
            <Property label="Estimate (min)">
              <Input
                key={`est-${task.estimateMinutes ?? ""}`}
                type="number"
                min={1}
                defaultValue={task.estimateMinutes ?? ""}
                disabled={!can.edit}
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v !== String(task.estimateMinutes ?? "")) save({ estimateMinutes: v });
                }}
                aria-label="Estimate in minutes"
              />
            </Property>
            <Property label="Labels">
              {can.edit ? (
                <Input
                  value={labelsDraft ?? task.labels.join(", ")}
                  onChange={(e) => setLabelsDraft(e.target.value)}
                  onBlur={() => {
                    if (labelsDraft !== null) save({ labels: labelsDraft });
                    setLabelsDraft(null);
                  }}
                  placeholder="design, api"
                  aria-label="Labels, comma separated"
                />
              ) : (
                <div className="flex flex-wrap gap-1 py-1">
                  {task.labels.length ? task.labels.map((l) => <Badge key={l}>{l}</Badge>) : <span className="text-[13px] text-subtle">None</span>}
                </div>
              )}
            </Property>
            <div className="space-y-2 pt-3 text-xs text-muted">
              <p className="flex justify-between">
                <span>Tracked</span>
                <span className="tabular text-fg">
                  {formatDuration(task.trackedSeconds)}
                  {task.estimateMinutes ? <span className="text-muted"> / {formatDuration(task.estimateMinutes * 60)}</span> : null}
                </span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Created by</span>
                <span className="flex items-center gap-1.5 truncate text-fg">
                  <Avatar name={detail.users[task.creatorId]?.name ?? "?"} src={detail.users[task.creatorId]?.avatar} size="xs" />
                  {detail.users[task.creatorId]?.name ?? "Former member"}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Created</span>
                <span className="text-fg">{formatLongDate(task.createdAt, timeZone)}</span>
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Dialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        title={`Complete ${ref}`}
        description="Optionally note what was done. This is shown on the task."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCompleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="complete-task-form" loading={complete.pending}>
              <StatusIcon status="DONE" className="text-current" />
              Mark complete
            </Button>
          </>
        }
      >
        <form
          id="complete-task-form"
          onSubmit={(e) => {
            e.preventDefault();
            const notes = new FormData(e.currentTarget).get("completionNotes");
            void complete.run({ taskId: task.id, completionNotes: typeof notes === "string" ? notes : "" });
          }}
        >
          <Textarea
            name="completionNotes"
            defaultValue={task.completionNotes}
            rows={4}
            maxLength={4000}
            placeholder="Shipped in release 2.3, see PR #142…"
            aria-label="Completion notes"
          />
        </form>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${ref}?`}
        description="Comments, time entries and attachments on this task are deleted too. This can't be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.pending} onClick={() => void remove.run({ taskId: task.id })}>
              Delete task
            </Button>
          </>
        }
      >
        <p className="text-sm">{task.title}</p>
      </Dialog>
    </div>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 py-0.5 md:grid-cols-1 md:gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}
