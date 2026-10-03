"use client";

import Link from "next/link";
import { Square } from "lucide-react";
import { formatClock } from "@/lib/dates";
import { cn, taskHref } from "@/lib/utils";
import { Tooltip } from "@/components/ui/menu";
import { useNow } from "./clock";
import { useTimer } from "./timer-provider";

export function ElapsedClock({ startedAt, className }: { startedAt: number; className?: string }) {
  const now = useNow();
  // Before the clock mounts, render a stable placeholder to avoid hydration mismatches.
  const seconds = now === 0 ? null : Math.max(0, (now - startedAt) / 1000);
  return <span className={cn("tabular font-mono", className)}>{seconds === null ? "--:--:--" : formatClock(seconds)}</span>;
}

/** Compact global indicator used in the sidebar (expanded or collapsed) and the mobile top bar. */
export function ActiveTimerCard({ collapsed = false }: { collapsed?: boolean }) {
  const { timer, stop, pending } = useTimer();
  if (!timer) return null;

  if (collapsed) {
    return (
      <Tooltip content={`${timer.taskRef} · ${timer.taskTitle}`} side="right">
        <button
          type="button"
          onClick={stop}
          disabled={pending}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent hover:opacity-80"
          aria-label="Stop timer"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      </Tooltip>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
        <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        Running
      </div>
      <Link
        href={taskHref(timer.projectId, timer.taskId)}
        className="mt-1 block truncate text-[13px] font-medium hover:underline"
        title={timer.taskTitle}
      >
        {timer.taskTitle}
      </Link>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <ElapsedClock startedAt={timer.startedAt} className="text-sm" />
        <button
          type="button"
          onClick={stop}
          disabled={pending}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-2 text-xs font-medium hover:bg-hover disabled:opacity-50"
        >
          <Square className="h-3 w-3 fill-current" aria-hidden />
          Stop
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
      <span className="animate-pulse-dot h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
      <Link href={taskHref(timer.projectId, timer.taskId)} className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{timer.taskTitle}</p>
        <p className="text-[11px] text-muted">{timer.taskRef}</p>
      </Link>
      <ElapsedClock startedAt={timer.startedAt} className="text-sm" />
      <button
        type="button"
        onClick={stop}
        disabled={pending}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg disabled:opacity-50"
        aria-label="Stop timer"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  );
}
