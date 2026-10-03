"use client";

import Link from "next/link";
import { RunningDot } from "@/components/timer/timer-display";
import { dueLabel, formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/types/views";
import { AssigneeStack } from "./assignee-stack";
import { DueBadge, PriorityIcon, StatusIcon } from "./task-meta";
import { useOpenTask } from "./use-open-task";

/** One-line task row for lists; wraps on small screens instead of overflowing. */
export function TaskRow({
  task,
  today,
  showProject = false,
  showModule = true,
}: {
  task: TaskItem;
  today: string;
  showProject?: boolean;
  showModule?: boolean;
}) {
  const { hrefFor } = useOpenTask();
  const due = task.dueDate && task.status !== "DONE" ? dueLabel(task.dueDate, today) : null;
  const place = task.subModuleName ? `${task.moduleName} / ${task.subModuleName}` : task.moduleName;
  return (
    <Link
      href={hrefFor(task.id)}
      scroll={false}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-hover sm:flex-nowrap"
    >
      <StatusIcon status={task.status} />
      <span className="w-16 shrink-0 font-mono text-[11px] text-subtle">{task.ref}</span>
      <span className={cn("min-w-0 flex-1 basis-40 truncate text-[13px]", task.status === "DONE" && "text-muted line-through decoration-subtle")}>
        {task.title}
      </span>
      <span className="flex shrink-0 items-center gap-3 pl-7 sm:pl-0">
        {task.runningUserIds.length > 0 ? <RunningDot /> : null}
        {showProject ? <span className="hidden max-w-32 truncate text-xs text-muted md:inline">{task.projectName}</span> : null}
        {showModule ? <span className="hidden max-w-44 truncate text-xs text-muted lg:inline">{place}</span> : null}
        {task.trackedSeconds > 0 ? <span className="tabular hidden text-[11px] text-muted sm:inline">{formatDuration(task.trackedSeconds)}</span> : null}
        {due ? <DueBadge {...due} /> : null}
        <PriorityIcon priority={task.priority} />
        <AssigneeStack people={task.assignees} max={2} />
      </span>
    </Link>
  );
}

export function TaskList({
  tasks,
  today,
  showProject,
  showModule,
  empty,
}: {
  tasks: TaskItem[];
  today: string;
  showProject?: boolean;
  showModule?: boolean;
  empty?: string;
}) {
  if (tasks.length === 0) return <p className="px-4 py-6 text-center text-[13px] text-subtle">{empty ?? "Tidak ada tugas."}</p>;
  return (
    <div className="divide-y divide-border">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} today={today} showProject={showProject} showModule={showModule} />
      ))}
    </div>
  );
}
