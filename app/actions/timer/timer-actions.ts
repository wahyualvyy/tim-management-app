"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { assertWritable, getProjectAccess, getTaskAccess } from "@/lib/domain/access";
import {
  claimTimer,
  deleteTimeLog,
  getActiveTimer,
  getTimeLog,
  recordTimeLog,
  releaseTimer,
} from "@/lib/redis/repositories/timer.repository";
import { getTask } from "@/lib/redis/repositories/task.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { atLeast, canTrackTime } from "@/lib/permissions";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { formatDuration, zonedMidnight } from "@/lib/dates";
import { revalidateApp } from "@/lib/revalidate";
import { manualTimeSchema, startTimerSchema, timeLogIdSchema } from "@/schemas/timer.schema";
import type { ActionResult } from "@/types/action";
import type { ActiveTimer } from "@/types/timer";

/** Timers shorter than this are discarded as accidental clicks. */
const MIN_SECONDS = 1;

/**
 * Finalize the user's running timer, if any. The duration is computed from
 * the server timestamps stored at start, so it is correct regardless of
 * what the browser did in the meantime.
 */
async function finalizeRunningTimer(userId: string): Promise<{ stopped: ActiveTimer | null; seconds: number }> {
  const timer = await releaseTimer(userId);
  if (!timer) return { stopped: null, seconds: 0 };
  const endedAt = Date.now();
  const seconds = Math.round((endedAt - timer.startedAt) / 1000);
  const task = await getTask(timer.taskId);
  // The task may have been deleted while the timer ran; then nothing is recorded.
  if (!task || seconds < MIN_SECONDS) return { stopped: timer, seconds: 0 };
  await recordTimeLog({
    taskId: timer.taskId,
    projectId: timer.projectId,
    userId,
    startedAt: timer.startedAt,
    endedAt,
    source: "timer",
    note: "",
  });
  await recordActivity({
    type: "timer.stopped",
    projectId: timer.projectId,
    actorId: userId,
    taskId: timer.taskId,
    subject: task.title,
    meta: { duration: formatDuration(seconds) },
  });
  return { stopped: timer, seconds };
}

export async function startTimerAction(input: unknown): Promise<ActionResult<ActiveTimer>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { taskId } = parseInput(startTimerSchema, input);
    const { task, project, role } = await getTaskAccess(taskId, user.id);
    assertWritable(project);
    if (!canTrackTime(role)) throw new ForbiddenError("Viewers can't track time.");

    const current = await getActiveTimer(user.id);
    if (current?.taskId === task.id) return current;
    // One timer per user: switching tasks stops and saves the previous timer.
    if (current) await finalizeRunningTimer(user.id);

    const timer = await claimTimer(user.id, task.id, project.id);
    if (!timer) throw new ConflictError("Another timer was started at the same time. Refresh and try again.");
    await recordActivity({
      type: "timer.started",
      projectId: project.id,
      actorId: user.id,
      taskId: task.id,
      subject: task.title,
    });
    revalidateApp();
    return timer;
  });
}

export async function stopTimerAction(): Promise<ActionResult<{ seconds: number }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { seconds } = await finalizeRunningTimer(user.id);
    revalidateApp();
    return { seconds };
  });
}

export async function addManualTimeAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { taskId, minutes, date, note } = parseInput(manualTimeSchema, input);
    const { task, project, role } = await getTaskAccess(taskId, user.id);
    assertWritable(project);
    if (!canTrackTime(role)) throw new ForbiddenError("Viewers can't track time.");
    // Manual entries are anchored at local noon of the chosen day.
    const startedAt = zonedMidnight(date, user.timezone) + 12 * 3600 * 1000;
    if (startedAt > Date.now()) throw new AppError("You can't log time in the future.");
    await recordTimeLog({
      taskId: task.id,
      projectId: project.id,
      userId: user.id,
      startedAt,
      endedAt: startedAt + minutes * 60 * 1000,
      source: "manual",
      note,
    });
    await recordActivity({
      type: "time.logged",
      projectId: project.id,
      actorId: user.id,
      taskId: task.id,
      subject: task.title,
      meta: { duration: formatDuration(minutes * 60) },
    });
    revalidateApp();
    return undefined;
  });
}

export async function deleteTimeLogAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { logId } = parseInput(timeLogIdSchema, input);
    const log = await getTimeLog(logId);
    if (!log) throw new NotFoundError("Time entry not found.");
    const { project, role } = await getProjectAccess(log.projectId, user.id);
    assertWritable(project);
    if (log.userId !== user.id && !atLeast(role, "LEAD")) throw new ForbiddenError();
    await deleteTimeLog(log);
    revalidateApp();
    return undefined;
  });
}
