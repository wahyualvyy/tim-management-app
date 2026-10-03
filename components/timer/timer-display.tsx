"use client";

import Link from "next/link";
import { Square } from "lucide-react";
import { formatClock } from "@/lib/dates";
import { totalWithRunning } from "@/lib/timer";
import { cn, taskHref } from "@/lib/utils";
import { Tooltip } from "@/components/ui/menu";
import { useNow } from "./clock";
import { useTimer } from "./timer-provider";

/** Elapsed time of a running session, computed from its server start timestamp. */
export function ElapsedClock({ startedAt, baseSeconds = 0, className }: { startedAt: number; baseSeconds?: number; className?: string }) {
  const now = useNow();
  // Before the clock mounts, show a stable placeholder so server and client HTML match.
  const text = now === 0 ? "--:--:--" : formatClock(totalWithRunning(baseSeconds, startedAt, now));
  return <span className={cn("tabular font-mono", className)}>{text}</span>;
}

export function RunningDot({ className }: { className?: string }) {
  return <span className={cn("animate-pulse-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent", className)} aria-hidden />;
}

/** Global indicator in the sidebar (expanded or collapsed). Clicking opens the task. */
export function ActiveTimerCard({ collapsed = false }: { collapsed?: boolean }) {
  const { timer, stop, pending } = useTimer();
  if (!timer) return null;
  const href = taskHref(timer.projectId, timer.taskId);

  if (collapsed) {
    return (
      <Tooltip content={`Sedang berjalan · ${timer.taskTitle}`} side="right">
        <Link
          href={href}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent"
          aria-label={`Timer berjalan: ${timer.taskTitle}`}
        >
          <RunningDot className="h-2 w-2" />
        </Link>
      </Tooltip>
    );
  }

  return (
    <div className="rounded-lg bg-accent-soft p-2.5">
      <Link href={href} className="block min-w-0 rounded-md focus-visible:outline-offset-4" aria-label={`Buka tugas ${timer.taskTitle}`}>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
          <RunningDot />
          Sedang berjalan
        </span>
        <span className="mt-1 block truncate text-[13px] font-medium" title={timer.taskTitle}>
          {timer.taskTitle}
        </span>
      </Link>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <ElapsedClock startedAt={timer.startedAt} className="text-sm text-fg" />
        <button
          type="button"
          onClick={stop}
          disabled={pending}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-surface px-2 text-xs font-medium shadow-sm hover:bg-hover disabled:opacity-50"
        >
          <Square className="h-3 w-3 fill-current" aria-hidden />
          Berhenti
        </button>
      </div>
    </div>
  );
}

/** Floating bar on small screens where the sidebar is hidden. */
export function MobileTimerBar() {
  const { timer, stop, pending } = useTimer();
  if (!timer) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 shadow-pop lg:hidden">
      <RunningDot className="h-2 w-2" />
      <Link href={taskHref(timer.projectId, timer.taskId)} className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{timer.taskTitle}</p>
        <p className="text-[11px] text-muted">Sedang berjalan{timer.taskRef ? ` · ${timer.taskRef}` : ""}</p>
      </Link>
      <ElapsedClock startedAt={timer.startedAt} className="text-sm" />
      <button
        type="button"
        onClick={stop}
        disabled={pending}
        className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-fg disabled:opacity-50"
        aria-label="Hentikan timer"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  );
}
