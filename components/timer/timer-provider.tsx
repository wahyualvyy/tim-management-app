"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { startTimerAction, stopTimerAction } from "@/app/actions/timer/timer-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDuration } from "@/lib/dates";
import { syncServerTime } from "./clock";

export interface TimerView {
  taskId: string;
  projectId: string;
  startedAt: number;
  taskTitle: string;
  taskRef: string;
}

type TaskInfo = Omit<TimerView, "startedAt">;

interface TimerContextValue {
  timer: TimerView | null;
  pending: boolean;
  start: (task: TaskInfo) => void;
  stop: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

/**
 * The active timer comes from Redis through the server layout on every
 * render, so it survives navigation, reloads and new sessions. Start/stop
 * update optimistically; the server action then revalidates the layout and
 * the authoritative timer replaces the optimistic one.
 */
export function TimerProvider({ initial, serverNow, children }: { initial: TimerView | null; serverNow: number; children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [timer, setOptimistic] = useOptimistic(initial);
  const [conflict, setConflict] = useState<{ next: TaskInfo; runningTitle: string } | null>(null);
  const toast = useToast();

  useEffect(() => {
    syncServerTime(serverNow);
  }, [serverNow]);

  const startTimer = useCallback(
    (task: TaskInfo, replaceRunning: boolean) =>
      startTransition(async () => {
        setOptimistic({ ...task, startedAt: Date.now() });
        const result = await startTimerAction({ taskId: task.taskId, replaceRunning });
        if (result.ok) return;
        if (result.code === "TIMER_ACTIVE") {
          setConflict({ next: task, runningTitle: result.meta?.taskTitle ?? "lain" });
        } else {
          toast.error(result.error);
        }
      }),
    [setOptimistic, toast],
  );

  const value = useMemo<TimerContextValue>(
    () => ({
      timer,
      pending,
      start: (task) => {
        // Ask before replacing a timer that is running on another task.
        if (timer && timer.taskId !== task.taskId) {
          setConflict({ next: task, runningTitle: timer.taskTitle });
          return;
        }
        startTimer(task, false);
      },
      stop: () =>
        startTransition(async () => {
          setOptimistic(null);
          const result = await stopTimerAction();
          if (!result.ok) toast.error(result.error);
          else if (result.data.seconds > 0) toast.success(`Tercatat ${formatDuration(result.data.seconds)}.`);
        }),
    }),
    [timer, pending, startTimer, setOptimistic, toast],
  );

  return (
    <TimerContext.Provider value={value}>
      {children}
      <Dialog
        open={conflict !== null}
        onOpenChange={(open) => (open ? undefined : setConflict(null))}
        title="Timer masih berjalan"
        description={`Anda masih memiliki timer aktif pada tugas "${conflict?.runningTitle ?? ""}".`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConflict(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (conflict) startTimer(conflict.next, true);
                setConflict(null);
              }}
            >
              Hentikan dan mulai tugas ini
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          Waktu pada tugas sebelumnya akan disimpan, lalu timer dimulai untuk &ldquo;{conflict?.next.taskTitle}&rdquo;.
        </p>
      </Dialog>
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside TimerProvider");
  return ctx;
}
