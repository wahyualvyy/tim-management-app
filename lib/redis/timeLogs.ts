import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray, num, oneOf, str, toHash, toRawHash, type RawHash } from "./serialize";
import { secondsBetween } from "@/lib/timer";
import { newId } from "@/lib/utils";
import type { Task } from "@/types/task";
import type { ActiveTimer, TimeLog, TimeLogSource, TimeSummary } from "@/types/timer";

/**
 * A running timer is one key per user holding the server start timestamp.
 * Elapsed time is always derived from timestamps; nothing is incremented
 * while a timer runs, so tab switches, sleep or reloads cannot skew it.
 */
export function parseTimer(raw: unknown): ActiveTimer | null {
  if (typeof raw !== "string") return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (
      typeof o.userId === "string" &&
      typeof o.taskId === "string" &&
      typeof o.projectId === "string" &&
      typeof o.startedAt === "number"
    ) {
      return { userId: o.userId, taskId: o.taskId, projectId: o.projectId, startedAt: o.startedAt };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function getActiveTimer(userId: string): Promise<ActiveTimer | null> {
  return parseTimer(await redis().get<string>(keys.userTimer(userId)));
}

/** Claims the user's single timer slot. Returns null if a timer is already running. */
export async function claimTimer(userId: string, taskId: string, projectId: string): Promise<ActiveTimer | null> {
  const timer: ActiveTimer = { userId, taskId, projectId, startedAt: Date.now() };
  const r = redis();
  if ((await r.set(keys.userTimer(userId), JSON.stringify(timer), { nx: true })) !== "OK") return null;
  await r.sadd(keys.taskTimers(taskId), userId);
  return timer;
}

/** Atomically takes the running timer out, so it can only be stopped once. */
export async function releaseTimer(userId: string): Promise<ActiveTimer | null> {
  const r = redis();
  const timer = parseTimer(await r.getdel<string>(keys.userTimer(userId)));
  if (timer) await r.srem(keys.taskTimers(timer.taskId), userId);
  return timer;
}

/** User ids with a timer running on each task, in one round trip. */
export async function getRunningUsers(taskIds: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (taskIds.length === 0) return out;
  const pipe = redis().pipeline();
  for (const id of taskIds) pipe.smembers(keys.taskTimers(id));
  const results = (await pipe.exec()) as unknown[];
  taskIds.forEach((id, i) => {
    const users = asStringArray(results[i]);
    if (users.length > 0) out.set(id, users);
  });
  return out;
}

function parseLog(hash: RawHash): TimeLog {
  return {
    id: str(hash, "id"),
    taskId: str(hash, "taskId"),
    projectId: str(hash, "projectId"),
    userId: str(hash, "userId"),
    startedAt: num(hash, "startedAt"),
    endedAt: num(hash, "endedAt"),
    durationSeconds: num(hash, "durationSeconds"),
    source: oneOf<TimeLogSource>(hash.source, ["timer", "manual"], "timer"),
    note: str(hash, "note"),
    createdAt: num(hash, "createdAt"),
  };
}

/** Every time aggregate a log contributes to, for the task's current place in the tree. */
function timeKeysFor(task: Pick<Task, "id" | "projectId" | "moduleId" | "subModuleId">): string[] {
  return [
    keys.taskTime(task.id),
    keys.projectTime(task.projectId),
    keys.moduleTime(task.moduleId),
    ...(task.subModuleId ? [keys.subModuleTime(task.subModuleId)] : []),
  ];
}

export interface TimeLogInput {
  userId: string;
  startedAt: number;
  endedAt: number;
  source: TimeLogSource;
  note: string;
}

/** Writes the finalized log and updates every aggregate in one transaction. */
export async function recordTimeLog(
  task: Pick<Task, "id" | "projectId" | "moduleId" | "subModuleId">,
  input: TimeLogInput,
): Promise<TimeLog> {
  const log: TimeLog = {
    id: newId(),
    taskId: task.id,
    projectId: task.projectId,
    ...input,
    durationSeconds: secondsBetween(input.startedAt, input.endedAt),
    createdAt: Date.now(),
  };
  const tx = redis().multi();
  tx.hset(keys.timeLog(log.id), toHash({ ...log }));
  tx.zadd(keys.taskTimeLogs(task.id), { score: log.startedAt, member: log.id });
  tx.zadd(keys.userTimeLogs(log.userId), { score: log.endedAt, member: log.id });
  tx.hincrby(keys.task(task.id), "trackedSeconds", log.durationSeconds);
  for (const key of timeKeysFor(task)) {
    tx.hincrby(key, "total", log.durationSeconds);
    tx.hincrby(key, log.userId, log.durationSeconds);
  }
  await tx.exec();
  return log;
}

export async function getTimeLog(logId: string): Promise<TimeLog | null> {
  const hash = toRawHash(await redis().hgetall(keys.timeLog(logId)));
  return hash ? parseLog(hash) : null;
}

async function loadLogs(ids: string[]): Promise<TimeLog[]> {
  if (ids.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of ids) pipe.hgetall(keys.timeLog(id));
  const results = (await pipe.exec()) as unknown[];
  return results.map(toRawHash).filter((h): h is RawHash => h !== null).map(parseLog);
}

/** Newest first, one page at a time. */
export async function listTaskTimeLogs(taskId: string, offset: number, limit: number): Promise<{ logs: TimeLog[]; hasMore: boolean }> {
  const ids = asStringArray(await redis().zrange(keys.taskTimeLogs(taskId), offset, offset + limit, { rev: true }));
  return { logs: await loadLogs(ids.slice(0, limit)), hasMore: ids.length > limit };
}

/** Logs the user finished at or after `since` (epoch ms). */
export async function listUserTimeLogsSince(userId: string, since: number): Promise<TimeLog[]> {
  return loadLogs(asStringArray(await redis().zrange(keys.userTimeLogs(userId), since, "+inf", { byScore: true })));
}

export async function deleteTimeLog(log: TimeLog, task: Pick<Task, "id" | "projectId" | "moduleId" | "subModuleId">): Promise<void> {
  const r = redis();
  if ((await r.zrem(keys.taskTimeLogs(log.taskId), log.id)) === 0) return;
  const tx = r.multi();
  tx.zrem(keys.userTimeLogs(log.userId), log.id);
  tx.del(keys.timeLog(log.id));
  tx.hincrby(keys.task(log.taskId), "trackedSeconds", -log.durationSeconds);
  for (const key of timeKeysFor(task)) {
    tx.hincrby(key, "total", -log.durationSeconds);
    tx.hincrby(key, log.userId, -log.durationSeconds);
  }
  await tx.exec();
}

function parseSummary(raw: unknown): TimeSummary {
  const hash = toRawHash(raw) ?? {};
  const byUser: Record<string, number> = {};
  for (const [field, value] of Object.entries(hash)) {
    const v = Number(value) || 0;
    if (field !== "total" && v > 0) byUser[field] = v;
  }
  return { totalSeconds: Math.max(0, num(hash, "total")), byUser };
}

export async function getTaskTime(taskId: string): Promise<TimeSummary> {
  return parseSummary(await redis().hgetall(keys.taskTime(taskId)));
}

export { parseSummary as parseTimeSummary };
