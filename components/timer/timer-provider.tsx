"use client";

import { createContext, useContext, useEffect, useMemo, useOptimistic, useTransition, type ReactNode } from "react";
import { startTimerAction, stopTimerAction } from "@/app/actions/timer/timer-actions";
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

interface TimerContextValue {
  timer: TimerView | null;
  pending: boolean;
  start: (task: Omit<TimerView, "startedAt">) => void;
  stop: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

/**
 * The active timer comes from Redis via the server layout on every render.
 * Start/stop update optimistically, then the server action revalidates the
 * layout so the authoritative timer replaces the optimistic one.
 */
export function TimerProvider({
  initial,
  serverNow,
  children,
}: {
  initial: TimerView | null;
  serverNow: number;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [timer, setOptimistic] = useOptimistic(initial);
  const toast = useToast();

  useEffect(() => {
    syncServerTime(serverNow);
  }, [serverNow]);

  const value = useMemo<TimerContextValue>(
    () => ({
      timer,
      pending,
      start: (task) =>
        startTransition(async () => {
          setOptimistic({ ...task, startedAt: Date.now() });
          const result = await startTimerAction({ taskId: task.taskId });
          if (!result.ok) toast.error(result.error);
        }),
      stop: () =>
        startTransition(async () => {
          setOptimistic(null);
          const result = await stopTimerAction();
          if (!result.ok) toast.error(result.error);
          else if (result.data.seconds > 0) toast.success(`Logged ${formatDuration(result.data.seconds)}`);
        }),
    }),
    [timer, pending, setOptimistic, toast],
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside TimerProvider");
  return ctx;
}
