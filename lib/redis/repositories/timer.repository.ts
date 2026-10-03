import "server-only";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { asStringArray, num, oneOf, str, toHash, toRawHash, type RawHash } from "@/lib/redis/serialize";
import { newId } from "@/lib/utils";
import type { ActiveTimer, TimeLog, TimeLogSource } from "@/types/timer";

/**
 * Timers are stored as a single key per user holding the server-side start
 * timestamp. Elapsed time is always derived from timestamps, never counted
 * up in the browser, so tab switches, sleep or reloads cannot skew it.
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
  return parseTimer(await redis().get<string>(keys.activeTimer(userId)));
}

/** Claims the user's timer slot. Returns null if another timer is already running. */
export async function claimTimer(userId: string, taskId: string, projectId: string): Promise<ActiveTimer | null> {
  const timer: ActiveTimer = { userId, taskId, projectId, startedAt: Date.now() };
  const ok = await redis().set(keys.activeTimer(userId), JSON.stringify(timer), { nx: true });
  return ok === "OK" ? timer : null;
}

/** Atomically removes and returns the running timer, so it can only be stopped once. */
export async function releaseTimer(userId: string): Promise<ActiveTimer | null> {
  return parseTimer(await redis().getdel<string>(keys.activeTimer(userId)));
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
  };
}

export interface TimeLogInput {
  taskId: string;
  projectId: string;
  userId: string;
  startedAt: number;
  endedAt: number;
  source: TimeLogSource;
  note: string;
}

/** Writes the finalized log and bumps the task total in one transaction. */
export async function recordTimeLog(input: TimeLogInput): Promise<TimeLog> {
  const log: TimeLog = {
    id: newId(),
    ...input,
    durationSeconds: Math.max(0, Math.round((input.endedAt - input.startedAt) / 1000)),
  };
  const tx = redis().multi();
  tx.hset(keys.timeLog(log.id), toHash({ ...log }));
  tx.zadd(keys.taskTimeLogs(log.taskId), { score: log.startedAt, member: log.id });
  tx.zadd(keys.userTimeLogs(log.userId), { score: log.endedAt, member: log.id });
  tx.hincrby(keys.task(log.taskId), "trackedSeconds", log.durationSeconds);
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

/** Newest first. */
export async function listTaskTimeLogs(taskId: string, limit = 50): Promise<TimeLog[]> {
  const ids = asStringArray(await redis().zrange(keys.taskTimeLogs(taskId), 0, limit - 1, { rev: true }));
  return loadLogs(ids);
}

/** Logs the user finished at or after `since` (epoch ms). */
export async function listUserTimeLogsSince(userId: string, since: number): Promise<TimeLog[]> {
  const ids = asStringArray(await redis().zrange(keys.userTimeLogs(userId), since, "+inf", { byScore: true }));
  return loadLogs(ids);
}

export async function deleteTimeLog(log: TimeLog): Promise<void> {
  const r = redis();
  const removed = await r.zrem(keys.taskTimeLogs(log.taskId), log.id);
  if (removed === 0) return;
  const tx = r.multi();
  tx.zrem(keys.userTimeLogs(log.userId), log.id);
  tx.del(keys.timeLog(log.id));
  tx.hincrby(keys.task(log.taskId), "trackedSeconds", -log.durationSeconds);
  await tx.exec();
}
