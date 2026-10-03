"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { addCommentAction, deleteCommentAction, updateCommentAction } from "@/app/actions/comment/comment-actions";
import { addManualTimeAction, deleteTimeLogAction } from "@/app/actions/timer/timer-actions";
import { removeAttachmentAction, uploadAttachmentAction } from "@/app/actions/task/attachment-actions";
import { useAction } from "@/components/hooks/use-action";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { describeActivity } from "@/lib/activity-format";
import { formatDateTime, formatDuration, formatLongDate } from "@/lib/dates";
import { emailHandle } from "@/lib/utils";
import type { TaskDetail } from "@/types/task-detail";

function userName(detail: TaskDetail, id: string): string {
  return detail.users[id]?.name ?? "Former member";
}

/** Renders comment text with @handles emphasized. Text is rendered as React text, never HTML. */
function CommentBody({ body }: { body: string }) {
  const parts = body.split(/(@[a-z0-9._-]{2,64})/gi);
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

export function TaskComments({
  detail,
  timeZone,
  onChanged,
}: {
  detail: TaskDetail;
  timeZone: string;
  onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
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
  const remove = useAction(deleteCommentAction, { onSuccess: onChanged });
  const handles = detail.members.map((m) => `@${emailHandle(m.email)}`).slice(0, 6).join(", ");

  return (
    <div className="space-y-4">
      {detail.comments.length === 0 ? <p className="text-[13px] text-subtle">No comments yet.</p> : null}
      <ul className="space-y-4">
        {detail.comments.map((c) => {
          const mine = c.authorId === detail.viewerId;
          const canDelete = detail.permissions.comment && (mine || detail.permissions.manageComments);
          return (
            <li key={c.id} className="group flex gap-2.5">
              <Avatar name={userName(detail, c.authorId)} src={detail.users[c.authorId]?.avatar} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium">{userName(detail, c.authorId)}</span>
                  <span className="text-[11px] text-subtle">
                    {formatDateTime(c.createdAt, timeZone)}
                    {c.edited ? " · edited" : ""}
                  </span>
                  <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    {mine && detail.permissions.comment ? (
                      <Button size="icon-sm" variant="ghost" aria-label="Edit comment" onClick={() => setEditing({ id: c.id, body: c.body })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete comment"
                        onClick={() => void remove.run({ commentId: c.id })}
                      >
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
                    <Textarea
                      value={editing.body}
                      onChange={(e) => setEditing({ id: c.id, body: e.target.value })}
                      rows={3}
                      maxLength={5000}
                      aria-label="Edit comment"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="primary" type="submit" loading={edit.pending}>
                        Save
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
            placeholder="Write a comment…"
            aria-label="New comment"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[11px] text-subtle" title={handles}>
              Mention with {handles || "@name"}
            </p>
            <Button size="sm" variant="primary" type="submit" loading={add.pending} disabled={!body.trim()}>
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-subtle">You can read comments but not post in this project.</p>
      )}
    </div>
  );
}

export function TaskTimeLogs({
  detail,
  timeZone,
  today,
  onChanged,
}: {
  detail: TaskDetail;
  timeZone: string;
  today: string;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const add = useAction(addManualTimeAction, {
    onSuccess: () => {
      setAdding(false);
      onChanged();
    },
    successMessage: "Time logged",
  });
  const remove = useAction(deleteTimeLogAction, { onSuccess: onChanged });
  const shownTotal = detail.timeLogs.reduce((sum, l) => sum + l.durationSeconds, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">
          <span className="tabular font-medium text-fg">{formatDuration(detail.task.trackedSeconds)}</span> tracked in total
        </p>
        {detail.permissions.trackTime && !adding ? (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Log time
          </Button>
        ) : null}
      </div>

      {adding ? (
        <form
          className="grid gap-3 rounded-lg border border-border bg-surface-2/50 p-3 sm:grid-cols-[100px_150px_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("taskId", detail.task.id);
            void add.run(fd);
          }}
        >
          <Field label="Minutes" htmlFor="log-minutes" error={add.fieldErrors.minutes}>
            <Input id="log-minutes" name="minutes" type="number" min={1} max={1440} required autoFocus />
          </Field>
          <Field label="Date" htmlFor="log-date" error={add.fieldErrors.date}>
            <Input id="log-date" name="date" type="date" defaultValue={today} max={today} required />
          </Field>
          <Field label="Note" htmlFor="log-note" error={add.fieldErrors.note}>
            <Input id="log-note" name="note" maxLength={300} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" type="submit" loading={add.pending}>
              Save entry
            </Button>
          </div>
        </form>
      ) : null}

      {detail.timeLogs.length === 0 ? (
        <p className="text-[13px] text-subtle">No time tracked yet. Start the timer from the top of this panel.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {detail.timeLogs.map((log) => {
            const canDelete =
              detail.permissions.trackTime && (log.userId === detail.viewerId || detail.permissions.manageComments);
            return (
              <li key={log.id} className="group flex items-center gap-2.5 px-3 py-2">
                <Avatar name={userName(detail, log.userId)} src={detail.users[log.userId]?.avatar} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">
                    {userName(detail, log.userId)}
                    {log.note ? <span className="text-muted"> · {log.note}</span> : null}
                  </p>
                  <p className="text-[11px] text-subtle">
                    {log.source === "manual" ? `Manual entry · ${formatLongDate(log.startedAt, timeZone)}` : `${formatDateTime(log.startedAt, timeZone)} – ${formatDateTime(log.endedAt, timeZone)}`}
                  </p>
                </div>
                <span className="tabular text-[13px] font-medium">{formatDuration(log.durationSeconds)}</span>
                {canDelete ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete time entry"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100"
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
      {detail.timeLogs.length >= 50 && shownTotal < detail.task.trackedSeconds ? (
        <p className="text-[11px] text-subtle">Showing the 50 most recent entries.</p>
      ) : null}
    </div>
  );
}

export function TaskActivityList({ detail, timeZone }: { detail: TaskDetail; timeZone: string }) {
  if (detail.activity.length === 0) return <p className="text-[13px] text-subtle">No activity yet.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {detail.activity.map((a) => (
        <li key={a.id} className="relative text-[13px]">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-border-strong bg-surface" aria-hidden />
          <span className="font-medium">{userName(detail, a.actorId)}</span>{" "}
          <span className="text-muted">{describeActivity(a)}</span>
          <span className="block text-[11px] text-subtle">{formatDateTime(a.createdAt, timeZone)}</span>
        </li>
      ))}
    </ol>
  );
}

export function TaskAttachments({ detail, onChanged }: { detail: TaskDetail; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useAction(uploadAttachmentAction, { onSuccess: onChanged, successMessage: "File attached" });
  const remove = useAction(removeAttachmentAction, { onSuccess: onChanged });
  const canUpload = detail.permissions.edit && detail.uploadsEnabled;
  if (detail.attachments.length === 0 && !canUpload) return null;

  return (
    <section aria-label="Attachments" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Paperclip className="h-3.5 w-3.5" aria-hidden /> Attachments
        </h3>
        {canUpload ? (
          <>
            <input
              ref={input}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set("taskId", detail.task.id);
                fd.set("file", file);
                void upload.run(fd);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="ghost" loading={upload.pending} onClick={() => input.current?.click()}>
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Upload
            </Button>
          </>
        ) : null}
      </div>
      {detail.attachments.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {detail.attachments.map((a) => (
            <li key={a.id} className="group flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[13px] hover:underline">
                {a.name}
              </a>
              <span className="text-[11px] text-subtle">{Math.max(1, Math.round(a.size / 1024))} KB</span>
              {detail.permissions.edit && (a.uploadedBy === detail.viewerId || detail.permissions.manageComments) ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${a.name}`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={() => void remove.run({ taskId: detail.task.id, attachmentId: a.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-subtle">No files attached.</p>
      )}
    </section>
  );
}
