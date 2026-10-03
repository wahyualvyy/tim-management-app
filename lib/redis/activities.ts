import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { newId } from "@/lib/utils";
import { ACTIVITY_TYPES, type Activity, type ActivityType } from "@/types/activity";

/** Lists are capped so activity cannot grow without bound. */
const PROJECT_ACTIVITY_LIMIT = 1000;
const TASK_ACTIVITY_LIMIT = 200;

export interface ActivityInput {
  type: ActivityType;
  projectId: string;
  actorId: string;
  taskId?: string | null;
  subject: string;
  meta?: Record<string, string>;
}

export function parseActivity(raw: unknown): Activity | null {
  if (typeof raw !== "string") return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (
      typeof o.id !== "string" ||
      typeof o.type !== "string" ||
      !(ACTIVITY_TYPES as readonly string[]).includes(o.type) ||
      typeof o.projectId !== "string" ||
      typeof o.actorId !== "string" ||
      typeof o.createdAt !== "number"
    ) {
      return null;
    }
    const meta: Record<string, string> = {};
    if (o.meta && typeof o.meta === "object") {
      for (const [k, val] of Object.entries(o.meta as Record<string, unknown>)) {
        if (typeof val === "string") meta[k] = val;
      }
    }
    return {
      id: o.id,
      type: o.type as ActivityType,
      projectId: o.projectId,
      actorId: o.actorId,
      taskId: typeof o.taskId === "string" ? o.taskId : null,
      subject: typeof o.subject === "string" ? o.subject : "",
      meta,
      createdAt: o.createdAt,
    };
  } catch {
    return null;
  }
}

/** Activity entries are small, immutable JSON items in capped lists (newest first). */
export async function recordActivity(input: ActivityInput): Promise<void> {
  const entry: Activity = {
    id: newId(),
    type: input.type,
    projectId: input.projectId,
    actorId: input.actorId,
    taskId: input.taskId ?? null,
    subject: input.subject.slice(0, 200),
    meta: input.meta ?? {},
    createdAt: Date.now(),
  };
  const json = JSON.stringify(entry);
  const pipe = redis().pipeline();
  pipe.lpush(keys.projectActivities(input.projectId), json);
  pipe.ltrim(keys.projectActivities(input.projectId), 0, PROJECT_ACTIVITY_LIMIT - 1);
  if (entry.taskId) {
    pipe.lpush(keys.taskActivities(entry.taskId), json);
    pipe.ltrim(keys.taskActivities(entry.taskId), 0, TASK_ACTIVITY_LIMIT - 1);
  }
  await pipe.exec();
}

export async function listProjectActivities(
  projectId: string,
  offset: number,
  limit: number,
): Promise<{ items: Activity[]; hasMore: boolean }> {
  const raw = await redis().lrange(keys.projectActivities(projectId), offset, offset + limit);
  const items = raw.map(parseActivity).filter((a): a is Activity => a !== null);
  return { items: items.slice(0, limit), hasMore: items.length > limit };
}

export async function listTaskActivities(taskId: string, limit = 50): Promise<Activity[]> {
  const raw = await redis().lrange(keys.taskActivities(taskId), 0, limit - 1);
  return raw.map(parseActivity).filter((a): a is Activity => a !== null);
}

/**
 * Latest activity across several projects, merged and sorted, in one round
 * trip. Reading `offset + limit` from each list is enough to page correctly.
 */
export async function listRecentActivities(
  projectIds: readonly string[],
  offset: number,
  limit: number,
): Promise<{ items: Activity[]; hasMore: boolean }> {
  if (projectIds.length === 0) return { items: [], hasMore: false };
  const pipe = redis().pipeline();
  for (const id of projectIds) pipe.lrange(keys.projectActivities(id), 0, offset + limit);
  const results = (await pipe.exec()) as unknown[];
  const all: Activity[] = [];
  for (const list of results) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const a = parseActivity(raw);
      if (a) all.push(a);
    }
  }
  all.sort((a, b) => b.createdAt - a.createdAt);
  return { items: all.slice(offset, offset + limit), hasMore: all.length > offset + limit };
}
