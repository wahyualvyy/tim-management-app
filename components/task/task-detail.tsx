"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Link2, MoreHorizontal, Play, Square, Trash2, X } from "lucide-react";
import { updateTaskAction } from "@/app/actions/task/update-task";
import { moveTaskAction } from "@/app/actions/task/move-task";
import { deleteTaskAction } from "@/app/actions/task/delete-task";
import { useAction } from "@/components/hooks/use-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, SheetClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { ElapsedClock, RunningDot } from "@/components/timer/timer-display";
import { useTimer } from "@/components/timer/timer-provider";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/task";
import type { TaskDetail } from "@/types/task-detail";
import { CompleteTaskDialog } from "./complete-task-dialog";
import { TaskProperties } from "./task-properties";
import { TaskActivityList, TaskAttachments, TaskComments, TaskTime } from "./task-detail-sections";

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
  const toast = useToast();
  const timer = useTimer();
  const [tab, setTab] = useState<Tab>("comments");
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const update = useAction(updateTaskAction, { onSuccess: onChanged });
  const move = useAction(moveTaskAction, { onSuccess: onChanged });
  const remove = useAction(deleteTaskAction, { onSuccess: onDeleted, successMessage: "Tugas dihapus." });

  const save = (patch: Record<string, unknown>) => void update.run({ taskId: task.id, ...patch });
  const running = timer.timer?.taskId === task.id ? timer.timer : null;
  const mod = detail.structure.find((m) => m.id === task.moduleId);
  const sub = mod?.subModules.find((s) => s.id === task.subModuleId);
  const others = detail.running.filter((r) => r.userId !== detail.viewerId);

  function commitTitle() {
    const value = titleDraft?.trim();
    setTitleDraft(null);
    if (value && value !== task.title) save({ title: value });
  }

  function changeStatus(status: TaskStatus) {
    if (status === "DONE") setCompleteOpen(true);
    else void move.run({ taskId: task.id, status });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted" aria-label="Lokasi tugas">
          <Link href={`/projects/${project.id}`} className="truncate hover:text-fg">
            {project.name}
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <Link href={`/projects/${project.id}/structure#node-${task.moduleId}`} className="hidden truncate hover:text-fg sm:inline">
            {mod?.name ?? "Modul"}
          </Link>
          {sub ? (
            <>
              <ChevronRight className="hidden h-3 w-3 shrink-0 sm:inline" aria-hidden />
              <Link href={`/projects/${project.id}/structure#node-${sub.id}`} className="hidden truncate hover:text-fg sm:inline">
                {sub.name}
              </Link>
            </>
          ) : null}
          <ChevronRight className="hidden h-3 w-3 shrink-0 sm:inline" aria-hidden />
          <span className="shrink-0 whitespace-nowrap font-mono text-fg">{detail.ref}</span>
        </nav>
        {can.trackTime ? (
          running ? (
            <Button size="sm" variant="primary" onClick={timer.stop} disabled={timer.pending} aria-label="Hentikan timer">
              <Square className="h-3 w-3 fill-current" aria-hidden />
              <ElapsedClock startedAt={running.startedAt} />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={timer.pending}
              onClick={() => timer.start({ taskId: task.id, projectId: project.id, taskTitle: task.title, taskRef: detail.ref })}
            >
              <Play className="h-3 w-3 fill-current" aria-hidden />
              <span className="hidden sm:inline">Mulai timer</span>
            </Button>
          )
        ) : null}
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Aksi lainnya">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              onSelect={() => {
                void navigator.clipboard
                  .writeText(`${window.location.origin}/projects/${project.id}/board?task=${task.id}`)
                  .then(() => toast.success("Tautan disalin."));
              }}
            >
              <Link2 className="h-4 w-4 text-muted" aria-hidden /> Salin tautan
            </MenuItem>
            {can.delete ? (
              <>
                <MenuSeparator />
                <MenuItem danger onSelect={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Hapus tugas
                </MenuItem>
              </>
            ) : null}
          </MenuContent>
        </Menu>
        <SheetClose className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-fg" aria-label="Tutup">
          <X className="h-4 w-4" />
        </SheetClose>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-5 py-5 md:grid-cols-[minmax(0,1fr)_230px]">
          <div className="min-w-0 space-y-5">
            {project.archived ? (
              <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">Proyek ini diarsipkan. Tugas hanya dapat dilihat.</p>
            ) : null}
            {running || others.length > 0 ? (
              <p className="flex items-center gap-2 text-xs font-medium text-accent">
                <RunningDot />
                {running ? "Sedang berjalan — timer Anda mencatat tugas ini" : `${others.length} orang sedang mengerjakan tugas ini`}
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
                aria-label="Judul tugas"
                className="field-sizing-content -mx-1 w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-lg font-semibold leading-snug hover:bg-hover focus:bg-surface-2 focus:outline-none"
              />
            ) : (
              <h2 className="text-lg font-semibold leading-snug">{task.title}</h2>
            )}

            <section aria-label="Deskripsi">
              {can.edit && descDraft !== null ? (
                <div className="space-y-2">
                  <Textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={6}
                    autoFocus
                    maxLength={10000}
                    placeholder="Tambahkan detail, kriteria selesai, atau tautan…"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDescDraft(null)}>
                      Batal
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
                      Simpan
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!can.edit}
                  onClick={() => setDescDraft(task.description)}
                  className={cn("-mx-2 block w-full rounded-md px-2 py-1.5 text-left text-sm leading-relaxed", can.edit && "hover:bg-hover")}
                >
                  {task.description ? (
                    <span className="whitespace-pre-wrap break-words">{task.description}</span>
                  ) : (
                    <span className="text-subtle">{can.edit ? "Tambahkan deskripsi…" : "Tidak ada deskripsi."}</span>
                  )}
                </button>
              )}
            </section>

            {task.status === "DONE" ? (
              <section className="rounded-lg bg-success-soft px-3 py-2.5" aria-label="Penyelesaian">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-success">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Selesai{task.completedAt ? ` pada ${formatLongDate(task.completedAt, timeZone)}` : ""}
                </p>
                {task.completionNotes ? <p className="mt-1 whitespace-pre-wrap text-[13px]">{task.completionNotes}</p> : null}
              </section>
            ) : can.edit ? (
              <Button variant="outline" size="sm" onClick={() => setCompleteOpen(true)}>
                <Check className="h-3.5 w-3.5" aria-hidden /> Tandai selesai
              </Button>
            ) : null}

            <TaskAttachments detail={detail} onChanged={onChanged} />

            <div>
              <div className="flex gap-5 border-b border-border" role="tablist" aria-label="Bagian tugas">
                {(
                  [
                    ["comments", `Komentar${detail.comments.length ? ` ${detail.comments.length}` : ""}`],
                    ["time", "Waktu"],
                    ["activity", "Aktivitas"],
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
              <div className="pt-4" role="tabpanel">
                {tab === "comments" ? <TaskComments detail={detail} timeZone={timeZone} onChanged={onChanged} /> : null}
                {tab === "time" ? <TaskTime detail={detail} timeZone={timeZone} today={today} onChanged={onChanged} /> : null}
                {tab === "activity" ? <TaskActivityList detail={detail} timeZone={timeZone} /> : null}
              </div>
            </div>
          </div>

          <TaskProperties detail={detail} today={today} timeZone={timeZone} save={save} onStatus={changeStatus} statusPending={move.pending} />
        </div>
      </div>

      <CompleteTaskDialog open={completeOpen} onOpenChange={setCompleteOpen} detail={detail} onDone={onChanged} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Hapus ${detail.ref}?`}
        description="Komentar, catatan waktu, dan lampiran tugas ini ikut terhapus. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus tugas"
        pending={remove.pending}
        onConfirm={() => void remove.run({ taskId: task.id })}
      >
        <p className="font-medium text-fg">{task.title}</p>
      </ConfirmDialog>
    </div>
  );
}
