"use client";

import { Clock3 } from "lucide-react";
import { RunningDot } from "@/components/timer/timer-display";
import { dueLabel, formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/types/views";
import { AssigneeStack } from "./assignee-stack";
import { DueBadge, PriorityIcon } from "./task-meta";

/** Compact board card. Details live in the drawer. */
export function TaskCard({ task, today, showModule = true, dragging = false }: { task: TaskItem; today: string; showModule?: boolean; dragging?: boolean }) {
  const due = task.dueDate && task.status !== "DONE" ? dueLabel(task.dueDate, today) : null;
  const place = task.subModuleName ?? task.moduleName;
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-2.5 text-left transition-[border-color,box-shadow] hover:border-border-strong",
        due?.tone === "overdue" && "border-l-2 border-l-danger",
        dragging && "rotate-[0.6deg] shadow-pop ring-1 ring-accent/40",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-subtle">
        <span className="font-mono">{task.ref}</span>
        {showModule ? <span className="truncate">· {place}</span> : null}
        {task.runningUserIds.length > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1 text-accent" title="Timer sedang berjalan">
            <RunningDot />
            <span className="sr-only">Timer sedang berjalan</span>
          </span>
        ) : null}
      </div>
      <p className={cn("mt-1 line-clamp-2 text-[13px] leading-snug", task.status === "DONE" && "text-muted line-through decoration-subtle")}>
        {task.title}
      </p>
      {task.labels.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => (
            <span key={l} className="rounded-md bg-surface-2 px-1.5 text-[10px] leading-4 text-muted">
              {l}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <PriorityIcon priority={task.priority} />
        {due ? <DueBadge {...due} /> : null}
        {task.trackedSeconds > 0 ? (
          <span className="tabular inline-flex items-center gap-1 text-[11px] text-muted">
            <Clock3 className="h-3 w-3" aria-hidden />
            {formatDuration(task.trackedSeconds)}
          </span>
        ) : null}
        <span className="ml-auto">
          <AssigneeStack people={task.assignees} />
        </span>
      </div>
    </div>
  );
}
