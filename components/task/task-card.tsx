"use client";

import { Clock3 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/menu";
import { dueLabel, formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/types/views";
import { DueBadge, PriorityIcon } from "./task-meta";

/** Compact board card. Kept small on purpose: details live in the drawer. */
export function TaskCard({
  task,
  today,
  showModule = true,
  dragging = false,
}: {
  task: TaskItem;
  today: string;
  showModule?: boolean;
  dragging?: boolean;
}) {
  const due = task.dueDate && task.status !== "DONE" ? dueLabel(task.dueDate, today) : null;
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-2.5 text-left shadow-card transition-colors hover:border-border-strong",
        dragging && "rotate-1 shadow-pop ring-1 ring-accent/40",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-subtle">
        <span className="font-mono">{task.ref}</span>
        {showModule ? <span className="truncate">· {task.moduleName}</span> : null}
      </div>
      <p className={cn("mt-1 line-clamp-2 text-[13px] leading-snug", task.status === "DONE" && "text-muted line-through decoration-subtle")}>
        {task.title}
      </p>
      {task.labels.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => (
            <span key={l} className="rounded border border-border px-1 text-[10px] leading-4 text-muted">
              {l}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <Tooltip content={task.priority === "NONE" ? "No priority" : `${task.priority.toLowerCase()} priority`}>
          <span>
            <PriorityIcon priority={task.priority} />
          </span>
        </Tooltip>
        {due ? <DueBadge {...due} /> : null}
        {task.trackedSeconds > 0 ? (
          <span className="tabular inline-flex items-center gap-1 text-[11px] text-muted">
            <Clock3 className="h-3 w-3" aria-hidden />
            {formatDuration(task.trackedSeconds)}
          </span>
        ) : null}
        <span className="ml-auto">
          {task.assignee ? (
            <Tooltip content={task.assignee.name}>
              <span>
                <Avatar name={task.assignee.name} src={task.assignee.avatar} size="xs" />
              </span>
            </Tooltip>
          ) : null}
        </span>
      </div>
    </div>
  );
}
