"use client";

import { useState, type ReactNode } from "react";
import { Input, Select } from "@/components/ui/input";
import { AssigneePicker } from "@/components/people/person-pickers";
import { Badge } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/avatar";
import { formatDuration, formatLongDate } from "@/lib/dates";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from "@/types/task";
import type { TaskDetail } from "@/types/task-detail";
import type { PersonOption } from "@/types/views";
import { ElapsedClock } from "@/components/timer/timer-display";

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] items-center gap-2 py-0.5 md:grid-cols-1 md:gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Right-hand property panel of the task drawer. Every change saves immediately. */
export function TaskProperties({
  detail,
  today,
  timeZone,
  save,
  onStatus,
  statusPending,
}: {
  detail: TaskDetail;
  today: string;
  timeZone: string;
  save: (patch: Record<string, unknown>) => void;
  onStatus: (status: TaskStatus) => void;
  statusPending: boolean;
}) {
  const { task, permissions: can } = detail;
  const [labelsDraft, setLabelsDraft] = useState<string | null>(null);
  const person = (id: string): PersonOption => {
    const u = detail.users[id];
    return { id, name: u?.name ?? "Mantan anggota", username: u?.username ?? "", avatar: u?.avatar ?? null, jobTitle: u?.jobTitle ?? "" };
  };
  const assignees = task.assigneeIds.map(person);
  const mod = detail.structure.find((m) => m.id === task.moduleId);
  const creator = detail.users[task.creatorId];
  const running = detail.running.find((r) => r.userId === detail.viewerId) ?? detail.running[0];

  return (
    <aside className="space-y-1 md:border-l md:border-border md:pl-5" aria-label="Properti tugas">
      <Property label="Status">
        <Select value={task.status} disabled={!can.edit || statusPending} onChange={(e) => onStatus(e.target.value as TaskStatus)} aria-label="Status">
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </Property>
      <Property label="Prioritas">
        <Select value={task.priority} disabled={!can.edit} onChange={(e) => save({ priority: e.target.value })} aria-label="Prioritas">
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
      </Property>
      <Property label="Penanggung jawab">
        <AssigneePicker
          projectId={detail.project.id}
          selected={assignees}
          disabled={!can.edit}
          allowOthers={can.assignOthers}
          self={person(detail.viewerId)}
          onChange={(next) => save({ assigneeIds: next.map((p) => p.id) })}
        />
      </Property>
      <Property label="Modul">
        <Select
          value={task.moduleId}
          disabled={!can.edit}
          onChange={(e) => save({ moduleId: e.target.value, subModuleId: "" })}
          aria-label="Modul"
        >
          {detail.structure.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Property>
      <Property label="Sub modul">
        <Select
          value={task.subModuleId ?? ""}
          disabled={!can.edit}
          onChange={(e) => save({ subModuleId: e.target.value })}
          aria-label="Sub modul"
        >
          <option value="">Langsung di modul</option>
          {(mod?.subModules ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Property>
      <Property label="Tanggal mulai">
        <Input type="date" value={task.startDate ?? ""} disabled={!can.edit} onChange={(e) => save({ startDate: e.target.value })} aria-label="Tanggal mulai" />
      </Property>
      <Property label="Tenggat">
        <Input
          type="date"
          value={task.dueDate ?? ""}
          disabled={!can.edit}
          onChange={(e) => save({ dueDate: e.target.value })}
          aria-label="Tenggat"
          className={cn(task.dueDate && task.status !== "DONE" && task.dueDate < today && "border-danger/50 text-danger")}
        />
      </Property>
      <Property label="Estimasi (menit)">
        <Input
          key={`est-${task.estimatedMinutes ?? ""}`}
          type="number"
          min={1}
          defaultValue={task.estimatedMinutes ?? ""}
          disabled={!can.edit}
          placeholder="—"
          onBlur={(e) => {
            if (e.target.value !== String(task.estimatedMinutes ?? "")) save({ estimatedMinutes: e.target.value });
          }}
          aria-label="Estimasi dalam menit"
        />
      </Property>
      <Property label="Label">
        {can.edit ? (
          <Input
            value={labelsDraft ?? task.labels.join(", ")}
            onChange={(e) => setLabelsDraft(e.target.value)}
            onBlur={() => {
              if (labelsDraft !== null) save({ labels: labelsDraft });
              setLabelsDraft(null);
            }}
            placeholder="desain, api"
            aria-label="Label, pisahkan dengan koma"
          />
        ) : (
          <div className="flex flex-wrap gap-1 py-1">
            {task.labels.length ? task.labels.map((l) => <Badge key={l}>{l}</Badge>) : <span className="text-[13px] text-subtle">Tidak ada</span>}
          </div>
        )}
      </Property>

      <dl className="space-y-2 pt-3 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Total waktu</dt>
          <dd className="tabular text-fg">
            {running ? (
              <ElapsedClock startedAt={running.startedAt} baseSeconds={task.trackedSeconds} />
            ) : (
              formatDuration(task.trackedSeconds)
            )}
            {task.estimatedMinutes ? <span className="text-muted"> / {formatDuration(task.estimatedMinutes * 60)}</span> : null}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">Dibuat oleh</dt>
          <dd className="flex min-w-0 items-center gap-1.5 text-fg">
            <Avatar name={creator?.name ?? "?"} src={creator?.avatar} size="xs" />
            <span className="truncate">{creator?.name ?? "Mantan anggota"}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Dibuat</dt>
          <dd className="text-fg">{formatLongDate(task.createdAt, timeZone)}</dd>
        </div>
      </dl>
    </aside>
  );
}
