"use server";

import { assertWritable, requireAuth, requireProjectAccess, requireTaskAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import {
  claimTimer,
  deleteTimeLog,
  getActiveTimer,
  getTimeLog,
  recordTimeLog,
  releaseTimer,
} from "@/lib/redis/timeLogs";
import { getTask } from "@/lib/redis/tasks";
import { getProject } from "@/lib/redis/projects";
import { recordActivity } from "@/lib/redis/activities";
import { atLeast, canTrackTime } from "@/lib/permissions";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { formatDuration, zonedMidnight } from "@/lib/dates";
import { secondsBetween, shouldRecordSession } from "@/lib/timer";
import { revalidateApp } from "@/lib/revalidate";
import { taskRef } from "@/lib/utils";
import { manualTimeSchema, startTimerSchema, timeLogIdSchema } from "@/schemas/timer.schema";
import type { ActionResult } from "@/types/action";
import type { ActiveTimer } from "@/types/timer";

/**
 * Finalize the user's running timer, if any. The duration comes from the
 * server timestamps stored at start, so it is correct whatever the browser
 * did meanwhile (tab switch, sleep, reload, closed window).
 */
async function finalizeRunningTimer(userId: string): Promise<number> {
  const timer = await releaseTimer(userId);
  if (!timer) return 0;
  const endedAt = Date.now();
  const seconds = secondsBetween(timer.startedAt, endedAt);
  const task = await getTask(timer.taskId);
  // If the task was deleted while the timer ran, nothing is recorded.
  if (!task || !shouldRecordSession(seconds)) return 0;
  await recordTimeLog(task, { userId, startedAt: timer.startedAt, endedAt, source: "timer", note: "" });
  await recordActivity({
    type: "timer.stopped",
    projectId: task.projectId,
    actorId: userId,
    taskId: task.id,
    subject: task.title,
    meta: { duration: formatDuration(seconds) },
  });
  return seconds;
}

/**
 * Starts a timer. Only one timer runs per user: if another task is being
 * tracked, the call fails with code TIMER_ACTIVE (and the running task in
 * `meta`) unless the user confirmed `replaceRunning`.
 */
export async function startTimerAction(input: unknown): Promise<ActionResult<ActiveTimer>> {
  return runAction("startTimer", async () => {
    const user = await requireAuth();
    const { taskId, replaceRunning } = parseInput(startTimerSchema, input);
    const { task, project, role } = await requireTaskAccess(user, taskId);
    assertWritable(project);
    if (!canTrackTime(role)) throw new ForbiddenError("Pengamat tidak dapat mencatat waktu.");

    const current = await getActiveTimer(user.id);
    if (current?.taskId === task.id) return current;
    if (current) {
      if (!replaceRunning) {
        const [runningTask, runningProject] = await Promise.all([getTask(current.taskId), getProject(current.projectId)]);
        throw new ConflictError(
          `Anda masih memiliki timer aktif pada tugas ${runningTask?.title ?? "lain"}.`,
          "TIMER_ACTIVE",
          {
            taskId: current.taskId,
            taskTitle: runningTask?.title ?? "Tugas yang dihapus",
            taskRef: runningTask && runningProject ? taskRef(runningProject.key, runningTask.number) : "",
          },
        );
      }
      await finalizeRunningTimer(user.id);
    }

    const timer = await claimTimer(user.id, task.id, project.id);
    if (!timer) throw new ConflictError("Timer lain baru saja dimulai. Muat ulang lalu coba lagi.");
    await recordActivity({ type: "timer.started", projectId: project.id, actorId: user.id, taskId: task.id, subject: task.title });
    revalidateApp();
    return timer;
  });
}

export async function stopTimerAction(): Promise<ActionResult<{ seconds: number }>> {
  return runAction("stopTimer", async () => {
    const user = await requireAuth();
    const seconds = await finalizeRunningTimer(user.id);
    revalidateApp();
    return { seconds };
  });
}

export async function addManualTimeAction(input: unknown): Promise<ActionResult> {
  return runAction("addManualTime", async () => {
    const user = await requireAuth();
    const { taskId, minutes, date, note } = parseInput(manualTimeSchema, input);
    const { task, project, role } = await requireTaskAccess(user, taskId);
    assertWritable(project);
    if (!canTrackTime(role)) throw new ForbiddenError("Pengamat tidak dapat mencatat waktu.");
    // Manual entries are anchored at local noon of the chosen day.
    const startedAt = zonedMidnight(date, user.timezone) + 12 * 3600 * 1000;
    if (startedAt > Date.now()) throw new AppError("Tidak dapat mencatat waktu di masa depan.");
    await recordTimeLog(task, { userId: user.id, startedAt, endedAt: startedAt + minutes * 60_000, source: "manual", note });
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
  return runAction("deleteTimeLog", async () => {
    const user = await requireAuth();
    const { logId } = parseInput(timeLogIdSchema, input);
    const log = await getTimeLog(logId);
    if (!log) throw new NotFoundError("Catatan waktu tidak ditemukan.");
    const { project, role } = await requireProjectAccess(user, log.projectId);
    assertWritable(project);
    if (log.userId !== user.id && !atLeast(role, "LEAD")) throw new ForbiddenError();
    const task = await getTask(log.taskId);
    if (!task) throw new NotFoundError("Tugas tidak ditemukan.");
    await deleteTimeLog(log, task);
    revalidateApp();
    return undefined;
  });
}
