"use client";

import { useRef, useState, useTransition } from "react";
import { BadgeCheck, FileText, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { addCommentAction, deleteCommentAction, updateCommentAction } from "@/app/actions/comment/comment-actions";
import { addManualTimeAction, deleteTimeLogAction } from "@/app/actions/timer/timer-actions";
import { removeAttachmentAction } from "@/app/actions/upload/upload-actions";
import { loadMoreTimeLogsAction, loadOlderCommentsAction } from "@/app/actions/task/get-task-detail";
import { uploadFile } from "@/components/uploads/upload-file";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/components/hooks/use-action";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/primitives";
import { ElapsedClock } from "@/components/timer/timer-display";
import { describeActivity } from "@/lib/activity-format";
import { formatDateTime, formatDuration, formatLongDate } from "@/lib/dates";
import { manualTimeSchema } from "@/schemas/timer.schema";
import type { TaskDetail } from "@/types/task-detail";
import type { Comment } from "@/types/task";
import type { TimeLog } from "@/types/timer";
import type { PublicUser } from "@/types/user";

function userName(detail: TaskDetail, id: string): string {
  return detail.users[id]?.name ?? "Mantan anggota";
}

/**
 * Extra pages loaded in the drawer (older comments, more time logs). They are
 * kept while the same task is open and dropped when another task opens.
 */
function useExtraPages<T>(taskId: string) {
  const [state, setState] = useState<{ taskId: string; items: T[]; users: Record<string, PublicUser>; exhausted: boolean }>({
    taskId,
    items: [],
    users: {},
    exhausted: false,
  });
  if (state.taskId !== taskId) setState({ taskId, items: [], users: {}, exhausted: false });
  const current = state.taskId === taskId ? state : { taskId, items: [] as T[], users: {}, exhausted: false };
  const add = (items: T[], users: Record<string, PublicUser>, exhausted: boolean) =>
    setState((prev) => (prev.taskId === taskId ? { taskId, items: [...prev.items, ...items], users: { ...prev.users, ...users }, exhausted } : prev));
  return { ...current, add };
}

/** Comment text with @mentions highlighted. Rendered as React text, never as HTML. */
function CommentBody({ body }: { body: string }) {
  const parts = body.split(/(@[a-z0-9][a-z0-9._-]{1,29})/gi);
  return (
    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-medium text-accent">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export function TaskComments({ detail, timeZone, onChanged }: { detail: TaskDetail; timeZone: string; onChanged: () => void }) {
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const add = useAction(addCommentAction, {
    onSuccess: () => {
      setBody("");
      onChanged();
    },
  });
  const edit = useAction(updateCommentAction, {
    onSuccess: () => {
      setEditing(null);
      onChanged();
    },
  });
  const remove = useAction(deleteCommentAction, {
    onSuccess: () => {
      setDeletingId(null);
      onChanged();
    },
  });
  const older = useExtraPages<Comment>(detail.task.id);
  const [loadingOlder, startOlder] = useTransition();
  const toast = useToast();
  const loaded = new Set(detail.comments.map((c) => c.id));
  const comments = [...older.items.filter((c) => !loaded.has(c.id)), ...detail.comments].sort((a, b) => a.createdAt - b.createdAt);
  const users = { ...older.users, ...detail.users };
  const name = (id: string) => users[id]?.name ?? "Mantan anggota";
  const hasOlder = detail.hasOlderComments && !older.exhausted;

  function loadOlder() {
    const oldest = comments[0];
    if (!oldest) return;
    startOlder(async () => {
      const res = await loadOlderCommentsAction({ taskId: detail.task.id, before: oldest.createdAt });
      if (!res.ok) return toast.error(res.error);
      // Pages arrive oldest first; prepend them before what is already shown.
      older.add(res.data.comments, res.data.users, !res.data.hasOlder);
    });
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? <p className="text-[13px] text-subtle">Belum ada komentar.</p> : null}
      {hasOlder ? (
        <Button size="sm" variant="ghost" loading={loadingOlder} onClick={loadOlder}>
          Muat komentar sebelumnya
        </Button>
      ) : null}
      <ul className="space-y-4">
        {comments.map((c) => {
          const mine = c.authorId === detail.viewerId;
          const canDelete = detail.permissions.comment && (mine || detail.permissions.moderate);
          return (
            <li key={c.id} className="group flex gap-2.5">
              <Avatar name={name(c.authorId)} src={users[c.authorId]?.avatar} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium">{name(c.authorId)}</span>
                  <span className="text-[11px] text-subtle">
                    {formatDateTime(c.createdAt, timeZone)}
                    {c.edited ? " · diedit" : ""}
                  </span>
                  <span className="ml-auto flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                    {mine && detail.permissions.comment ? (
                      <Button size="icon-sm" variant="ghost" aria-label="Ubah komentar" onClick={() => setEditing({ id: c.id, body: c.body })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button size="icon-sm" variant="ghost" aria-label="Hapus komentar" onClick={() => setDeletingId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </span>
                </div>
                {editing?.id === c.id ? (
                  <form
                    className="mt-1.5 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void edit.run({ commentId: c.id, body: editing.body });
                    }}
                  >
                    <Textarea value={editing.body} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} rows={3} maxLength={5000} aria-label="Ubah komentar" autoFocus />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Batal
                      </Button>
                      <Button size="sm" variant="primary" type="submit" loading={edit.pending}>
                        Simpan
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-0.5">
                    <CommentBody body={c.body} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {detail.permissions.comment ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) void add.run({ taskId: detail.task.id, body });
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
            }}
            rows={3}
            maxLength={5000}
            placeholder="Tulis komentar…"
            aria-label="Komentar baru"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[11px] text-subtle">Sebut rekan dengan @username</p>
            <Button size="sm" variant="primary" type="submit" loading={add.pending} disabled={!body.trim()}>
              Kirim
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-subtle">Anda dapat membaca komentar, tetapi tidak dapat menulis di proyek ini.</p>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => (open ? undefined : setDeletingId(null))}
        title="Hapus komentar?"
        description="Komentar akan dihapus untuk semua anggota."
        confirmLabel="Hapus"
        pending={remove.pending}
        onConfirm={() => deletingId && void remove.run({ commentId: deletingId })}
      />
    </div>
  );
}

export function TaskTime({ detail, timeZone, today, onChanged }: { detail: TaskDetail; timeZone: string; today: string; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const add = useAction(addManualTimeAction, {
    schema: manualTimeSchema,
    successMessage: "Waktu berhasil dicatat.",
    onSuccess: () => {
      setAdding(false);
      onChanged();
    },
  });
  const remove = useAction(deleteTimeLogAction, { onSuccess: onChanged });
  const perUser = Object.entries(detail.time.byUser).sort((a, b) => b[1] - a[1]);
  const more = useExtraPages<TimeLog>(detail.task.id);
  const [loadingMore, startMore] = useTransition();
  const toast = useToast();
  const shown = new Set(detail.timeLogs.map((l) => l.id));
  const logs = [...detail.timeLogs, ...more.items.filter((l) => !shown.has(l.id))];
  const users = { ...more.users, ...detail.users };
  const name = (id: string) => users[id]?.name ?? "Mantan anggota";

  function loadMore() {
    startMore(async () => {
      const res = await loadMoreTimeLogsAction({ taskId: detail.task.id, offset: logs.length });
      if (!res.ok) return toast.error(res.error);
      more.add(res.data.logs, res.data.users, !res.data.hasMore);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Total tercatat</p>
          <p className="tabular text-lg font-semibold">{formatDuration(detail.task.trackedSeconds)}</p>
        </div>
        {detail.permissions.trackTime && !adding ? (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Catat manual
          </Button>
        ) : null}
      </div>

      {detail.running.length > 0 ? (
        <ul className="space-y-1.5">
          {detail.running.map((r) => (
            <li key={r.userId} className="flex items-center gap-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-[13px]">
              <Avatar name={name(r.userId)} src={users[r.userId]?.avatar} size="xs" />
              <span className="min-w-0 flex-1 truncate">{name(r.userId)} sedang berjalan</span>
              <ElapsedClock startedAt={r.startedAt} className="text-accent" />
            </li>
          ))}
        </ul>
      ) : null}

      {perUser.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Per orang</p>
          <ul className="space-y-1">
            {perUser.map(([userId, seconds]) => (
              <li key={userId} className="flex items-center gap-2 text-[13px]">
                <Avatar name={name(userId)} src={users[userId]?.avatar} size="xs" />
                <span className="min-w-0 flex-1 truncate">{name(userId)}</span>
                <span className="tabular font-medium">{formatDuration(seconds)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {adding ? (
        <form
          noValidate
          className="grid gap-3 rounded-lg bg-surface-2 p-3 sm:grid-cols-[100px_150px_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("taskId", detail.task.id);
            void add.run(fd);
          }}
        >
          <Field label="Menit" htmlFor="log-minutes" error={add.fieldErrors.minutes}>
            <Input id="log-minutes" name="minutes" type="number" min={1} max={1440} required autoFocus />
          </Field>
          <Field label="Tanggal" htmlFor="log-date" error={add.fieldErrors.date}>
            <Input id="log-date" name="date" type="date" defaultValue={today} max={today} required />
          </Field>
          <Field label="Catatan" htmlFor="log-note" error={add.fieldErrors.note}>
            <Input id="log-note" name="note" maxLength={300} placeholder="Opsional" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Batal
            </Button>
            <Button size="sm" variant="primary" type="submit" loading={add.pending}>
              Simpan
            </Button>
          </div>
        </form>
      ) : null}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Riwayat sesi</p>
        {logs.length === 0 ? (
          <p className="text-[13px] text-subtle">Belum ada waktu tercatat. Mulai timer dari bagian atas panel ini.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {logs.map((log) => {
              const canDelete = detail.permissions.trackTime && (log.userId === detail.viewerId || detail.permissions.moderate);
              return (
                <li key={log.id} className="group flex items-center gap-2.5 px-3 py-2">
                  <Avatar name={name(log.userId)} src={users[log.userId]?.avatar} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">
                      {name(log.userId)}
                      {log.note ? <span className="text-muted"> · {log.note}</span> : null}
                    </p>
                    <p className="text-[11px] text-subtle">
                      {log.source === "manual"
                        ? `Manual · ${formatLongDate(log.startedAt, timeZone)}`
                        : `${formatDateTime(log.startedAt, timeZone)} – ${formatDateTime(log.endedAt, timeZone)}`}
                    </p>
                  </div>
                  <span className="tabular text-[13px] font-medium">{formatDuration(log.durationSeconds)}</span>
                  {canDelete ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Hapus catatan waktu"
                      className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      onClick={() => void remove.run({ logId: log.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {detail.hasMoreTimeLogs && !more.exhausted ? (
          <Button size="sm" variant="ghost" className="mt-2" loading={loadingMore} onClick={loadMore}>
            Muat sesi lainnya
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TaskActivityList({ detail, timeZone }: { detail: TaskDetail; timeZone: string }) {
  if (detail.activity.length === 0) return <p className="text-[13px] text-subtle">Belum ada aktivitas.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {detail.activity.map((a) => (
        <li key={a.id} className="relative text-[13px]">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-border-strong bg-surface" aria-hidden />
          <span className="font-medium">{userName(detail, a.actorId)}</span> <span className="text-muted">{describeActivity(a)}</span>
          <span className="block text-[11px] text-subtle">{formatDateTime(a.createdAt, timeZone)}</span>
        </li>
      ))}
    </ol>
  );
}

export function TaskAttachments({ detail, onChanged }: { detail: TaskDetail; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const toast = useToast();
  const remove = useAction(removeAttachmentAction, { onSuccess: onChanged });
  const [removing, setRemoving] = useState<string | null>(null);
  const mode = detail.uploadMode;
  const canUpload = detail.permissions.edit && mode !== null;
  if (detail.attachments.length === 0 && !canUpload) return null;

  return (
    <section aria-label="Lampiran" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Paperclip className="h-3.5 w-3.5" aria-hidden /> Lampiran
        </h3>
        {canUpload ? (
          <>
            <input
              ref={input}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !mode) return;
                startUpload(async () => {
                  const res = await uploadFile(mode, { kind: "attachment", taskId: detail.task.id }, file, `attachments/${detail.project.id}/${detail.task.id}`);
                  if (!res.ok) return toast.error(res.error);
                  toast.success("Berkas terlampir.");
                  onChanged();
                });
              }}
            />
            <Button size="sm" variant="ghost" loading={uploading} onClick={() => input.current?.click()}>
              <Upload className="h-3.5 w-3.5" aria-hidden /> Unggah
            </Button>
          </>
        ) : null}
      </div>
      {detail.attachments.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {detail.attachments.map((a) => (
            <li key={a.id} className="group flex items-center gap-2 rounded-md bg-surface-2 px-2.5 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <a href={a.href} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[13px] hover:underline">
                {a.filename}
              </a>
              {a.isProof ? (
                <Badge tone="success">
                  <BadgeCheck className="h-3 w-3" aria-hidden /> Bukti
                </Badge>
              ) : null}
              <span className="text-[11px] text-subtle">{Math.max(1, Math.round(a.size / 1024))} KB</span>
              {detail.permissions.edit && (a.uploadedBy === detail.viewerId || detail.permissions.moderate) ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Hapus ${a.filename}`}
                  className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  onClick={() => setRemoving(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-subtle">Belum ada lampiran.</p>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title="Hapus lampiran?"
        description="Berkas akan dihapus dari tugas ini dan dari penyimpanan."
        confirmLabel="Hapus"
        pending={remove.pending}
        onConfirm={() => {
          if (removing) void remove.run({ taskId: detail.task.id, attachmentId: removing });
          setRemoving(null);
        }}
      />
    </section>
  );
}
