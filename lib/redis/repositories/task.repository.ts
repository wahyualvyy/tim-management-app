import "server-only";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import {
  asStringArray,
  num,
  numOrNull,
  oneOf,
  str,
  strOrNull,
  stringArray,
  toHash,
  toRawHash,
  type RawHash,
} from "@/lib/redis/serialize";
import { searchField, searchText } from "@/lib/redis/repositories/search.repository";
import { isoDateToScore } from "@/lib/dates";
import { newId } from "@/lib/utils";
import { TASK_PRIORITIES, TASK_STATUSES, type Attachment, type Task, type TaskStatus } from "@/types/task";

/** Upper bound on tasks loaded for a single project view. */
export const MAX_TASKS_PER_VIEW = 1000;

export function parseTask(hash: RawHash): Task {
  return {
    id: str(hash, "id"),
    projectId: str(hash, "projectId"),
    moduleId: str(hash, "moduleId"),
    number: num(hash, "number"),
    title: str(hash, "title"),
    description: str(hash, "description"),
    status: oneOf(hash.status, TASK_STATUSES, "TODO"),
    priority: oneOf(hash.priority, TASK_PRIORITIES, "NONE"),
    assigneeId: strOrNull(hash, "assigneeId"),
    creatorId: str(hash, "creatorId"),
    startDate: strOrNull(hash, "startDate"),
    dueDate: strOrNull(hash, "dueDate"),
    labels: stringArray(hash.labels),
    estimateMinutes: numOrNull(hash, "estimateMinutes"),
    trackedSeconds: num(hash, "trackedSeconds"),
    completionNotes: str(hash, "completionNotes"),
    completedAt: numOrNull(hash, "completedAt"),
    createdAt: num(hash, "createdAt"),
    updatedAt: num(hash, "updatedAt"),
  };
}

export async function getTask(taskId: string): Promise<Task | null> {
  const hash = toRawHash(await redis().hgetall(keys.task(taskId)));
  return hash ? parseTask(hash) : null;
}

export async function getTasks(taskIds: readonly string[]): Promise<Task[]> {
  if (taskIds.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of taskIds) pipe.hgetall(keys.task(id));
  const results = (await pipe.exec()) as unknown[];
  return results.map(toRawHash).filter((h): h is RawHash => h !== null).map(parseTask);
}

export async function listProjectTasks(projectId: string): Promise<Task[]> {
  const ids = asStringArray(
    await redis().zrange(keys.projectTasks(projectId), 0, MAX_TASKS_PER_VIEW - 1, { rev: true }),
  );
  return getTasks(ids);
}

/** Tasks for several projects, batched into two round trips. */
export async function listTasksForProjects(projectIds: readonly string[]): Promise<Task[]> {
  if (projectIds.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of projectIds) pipe.zrange(keys.projectTasks(id), 0, MAX_TASKS_PER_VIEW - 1, { rev: true });
  const results = (await pipe.exec()) as unknown[];
  return getTasks(results.flatMap(asStringArray));
}

export async function listAssignedTasks(userId: string): Promise<Task[]> {
  const ids = asStringArray(
    await redis().zrange(keys.userAssigned(userId), 0, MAX_TASKS_PER_VIEW - 1, { rev: true }),
  );
  return getTasks(ids);
}

/** Tasks with a due or start date inside [from, to] (ISO dates) across projects. */
export async function listScheduledTasks(projectIds: readonly string[], from: string, to: string): Promise<Task[]> {
  if (projectIds.length === 0) return [];
  const min = isoDateToScore(from);
  const max = isoDateToScore(to);
  const pipe = redis().pipeline();
  for (const id of projectIds) {
    pipe.zrange(keys.projectDue(id), min, max, { byScore: true });
    pipe.zrange(keys.projectStart(id), min, max, { byScore: true });
  }
  const results = (await pipe.exec()) as unknown[];
  const ids = [...new Set(results.flatMap(asStringArray))];
  return getTasks(ids);
}

export interface CreateTaskInput {
  projectId: string;
  moduleId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Task["priority"];
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  labels: string[];
  estimateMinutes: number | null;
}

function indexText(task: Pick<Task, "title" | "description" | "labels">, ref: string): string {
  return searchText(ref, task.title, task.labels.join(" "), task.description.slice(0, 200));
}

export async function createTask(input: CreateTaskInput, creatorId: string, projectKey: string): Promise<Task> {
  const r = redis();
  const id = newId();
  const number = await r.incr(keys.projectTaskSeq(input.projectId));
  const now = Date.now();
  const task: Task = {
    id,
    ...input,
    number,
    creatorId,
    trackedSeconds: 0,
    completionNotes: "",
    completedAt: input.status === "DONE" ? now : null,
    createdAt: now,
    updatedAt: now,
  };
  const done = task.status === "DONE" ? 1 : 0;
  const tx = r.multi();
  tx.hset(keys.task(id), toHash({ ...task }));
  tx.zadd(keys.projectTasks(task.projectId), { score: now, member: id });
  tx.zadd(keys.moduleTasks(task.moduleId), { score: now, member: id });
  tx.hincrby(keys.projectStats(task.projectId), "total", 1);
  tx.hincrby(keys.moduleStats(task.moduleId), "total", 1);
  if (done) {
    tx.hincrby(keys.projectStats(task.projectId), "done", 1);
    tx.hincrby(keys.moduleStats(task.moduleId), "done", 1);
  }
  if (task.assigneeId) tx.zadd(keys.userAssigned(task.assigneeId), { score: now, member: id });
  if (task.dueDate) tx.zadd(keys.projectDue(task.projectId), { score: isoDateToScore(task.dueDate), member: id });
  if (task.startDate) {
    tx.zadd(keys.projectStart(task.projectId), { score: isoDateToScore(task.startDate), member: id });
  }
  tx.sadd(keys.taskWatchers(id), creatorId, ...(task.assigneeId ? [task.assigneeId] : []));
  tx.hset(keys.projectSearch(task.projectId), {
    [searchField("task", id)]: indexText(task, `${projectKey}-${number}`),
  });
  await tx.exec();
  return task;
}

/**
 * Atomic status transition. The Lua script reads the current status and
 * adjusts the "done" counters only when the task actually crosses the DONE
 * boundary, so concurrent board moves cannot double count.
 * Returns the previous status, or null if the task no longer exists.
 */
const SET_STATUS_SCRIPT = `
local old = redis.call('HGET', KEYS[1], 'status')
if not old then return false end
if old == ARGV[1] then return old end
redis.call('HSET', KEYS[1], 'status', ARGV[1], 'updatedAt', ARGV[2])
if ARGV[1] == 'DONE' then
  redis.call('HSET', KEYS[1], 'completedAt', ARGV[2])
  redis.call('HINCRBY', KEYS[2], 'done', 1)
  redis.call('HINCRBY', KEYS[3], 'done', 1)
elseif old == 'DONE' then
  redis.call('HSET', KEYS[1], 'completedAt', '')
  redis.call('HINCRBY', KEYS[2], 'done', -1)
  redis.call('HINCRBY', KEYS[3], 'done', -1)
end
return old
`;

export async function setTaskStatus(task: Task, status: TaskStatus): Promise<TaskStatus | null> {
  const result = await redis().eval<string[], unknown>(
    SET_STATUS_SCRIPT,
    [keys.task(task.id), keys.projectStats(task.projectId), keys.moduleStats(task.moduleId)],
    [status, String(Date.now())],
  );
  return typeof result === "string" ? oneOf(result, TASK_STATUSES, "TODO") : null;
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "priority"
    | "assigneeId"
    | "startDate"
    | "dueDate"
    | "labels"
    | "estimateMinutes"
    | "completionNotes"
    | "moduleId"
  >
>;

/** Update non-status fields and keep every secondary index in sync. */
export async function updateTask(task: Task, patch: TaskPatch, projectKey: string): Promise<Task> {
  const next: Task = { ...task, ...patch, updatedAt: Date.now() };
  const tx = redis().multi();
  tx.hset(keys.task(task.id), toHash({ ...patch, updatedAt: next.updatedAt }));

  if (patch.assigneeId !== undefined && patch.assigneeId !== task.assigneeId) {
    if (task.assigneeId) tx.zrem(keys.userAssigned(task.assigneeId), task.id);
    if (next.assigneeId) {
      tx.zadd(keys.userAssigned(next.assigneeId), { score: task.createdAt, member: task.id });
      tx.sadd(keys.taskWatchers(task.id), next.assigneeId);
    }
  }
  if (patch.dueDate !== undefined && patch.dueDate !== task.dueDate) {
    if (next.dueDate) {
      tx.zadd(keys.projectDue(task.projectId), { score: isoDateToScore(next.dueDate), member: task.id });
    } else {
      tx.zrem(keys.projectDue(task.projectId), task.id);
    }
  }
  if (patch.startDate !== undefined && patch.startDate !== task.startDate) {
    if (next.startDate) {
      tx.zadd(keys.projectStart(task.projectId), { score: isoDateToScore(next.startDate), member: task.id });
    } else {
      tx.zrem(keys.projectStart(task.projectId), task.id);
    }
  }
  if (patch.moduleId !== undefined && patch.moduleId !== task.moduleId) {
    const done = task.status === "DONE" ? 1 : 0;
    tx.zrem(keys.moduleTasks(task.moduleId), task.id);
    tx.zadd(keys.moduleTasks(next.moduleId), { score: task.createdAt, member: task.id });
    tx.hincrby(keys.moduleStats(task.moduleId), "total", -1);
    tx.hincrby(keys.moduleStats(next.moduleId), "total", 1);
    if (done) {
      tx.hincrby(keys.moduleStats(task.moduleId), "done", -1);
      tx.hincrby(keys.moduleStats(next.moduleId), "done", 1);
    }
  }
  if (patch.title !== undefined || patch.description !== undefined || patch.labels !== undefined) {
    tx.hset(keys.projectSearch(task.projectId), {
      [searchField("task", task.id)]: indexText(next, `${projectKey}-${task.number}`),
    });
  }
  await tx.exec();
  return next;
}

/** Adds seconds to a task's tracked total (negative to subtract when a log is deleted). */
export async function addTrackedSeconds(taskId: string, seconds: number): Promise<void> {
  await redis().hincrby(keys.task(taskId), "trackedSeconds", Math.round(seconds));
}

/**
 * Delete a task and its dependent data. Removing it from the project index
 * first acts as a lock: only the caller that actually removed it continues,
 * so counters are never decremented twice.
 */
export async function deleteTask(task: Task): Promise<boolean> {
  const r = redis();
  const removed = await r.zrem(keys.projectTasks(task.projectId), task.id);
  if (removed === 0) return false;
  const [commentIds, logs] = await Promise.all([
    r.zrange(keys.taskComments(task.id), 0, -1),
    r.zrange(keys.taskTimeLogs(task.id), 0, -1),
  ]);
  const logIds = asStringArray(logs);
  const logUsers = logIds.length > 0 ? await getLogOwners(logIds) : [];
  const tx = r.multi();
  tx.zrem(keys.moduleTasks(task.moduleId), task.id);
  tx.zrem(keys.projectDue(task.projectId), task.id);
  tx.zrem(keys.projectStart(task.projectId), task.id);
  tx.hincrby(keys.projectStats(task.projectId), "total", -1);
  tx.hincrby(keys.moduleStats(task.moduleId), "total", -1);
  if (task.status === "DONE") {
    tx.hincrby(keys.projectStats(task.projectId), "done", -1);
    tx.hincrby(keys.moduleStats(task.moduleId), "done", -1);
  }
  if (task.assigneeId) tx.zrem(keys.userAssigned(task.assigneeId), task.id);
  tx.hdel(keys.projectSearch(task.projectId), searchField("task", task.id));
  logIds.forEach((logId, i) => {
    const owner = logUsers[i];
    if (owner) tx.zrem(keys.userTimeLogs(owner), logId);
    tx.del(keys.timeLog(logId));
  });
  for (const c of asStringArray(commentIds)) tx.del(keys.comment(c));
  tx.del(
    keys.task(task.id),
    keys.taskComments(task.id),
    keys.taskTimeLogs(task.id),
    keys.taskAttachments(task.id),
    keys.taskActivity(task.id),
    keys.taskWatchers(task.id),
  );
  await tx.exec();
  return true;
}

async function getLogOwners(logIds: string[]): Promise<(string | null)[]> {
  const pipe = redis().pipeline();
  for (const id of logIds) pipe.hget(keys.timeLog(id), "userId");
  const results = (await pipe.exec()) as unknown[];
  return results.map((v) => (typeof v === "string" && v ? v : null));
}

export async function getWatchers(taskId: string): Promise<string[]> {
  return asStringArray(await redis().smembers(keys.taskWatchers(taskId)));
}

export async function addWatcher(taskId: string, userId: string): Promise<void> {
  await redis().sadd(keys.taskWatchers(taskId), userId);
}

// Attachments: metadata only. File bytes live in external object storage.

function parseAttachment(raw: unknown): Attachment | null {
  if (typeof raw !== "string") return null;
  try {
    const v = JSON.parse(raw) as Partial<Attachment>;
    if (typeof v.id !== "string" || typeof v.url !== "string" || typeof v.name !== "string") return null;
    return {
      id: v.id,
      taskId: typeof v.taskId === "string" ? v.taskId : "",
      name: v.name,
      url: v.url,
      size: typeof v.size === "number" ? v.size : 0,
      contentType: typeof v.contentType === "string" ? v.contentType : "",
      uploadedBy: typeof v.uploadedBy === "string" ? v.uploadedBy : "",
      createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
    };
  } catch {
    return null;
  }
}

export async function listAttachments(taskId: string): Promise<Attachment[]> {
  const raw: unknown[] = await redis().hvals(keys.taskAttachments(taskId));
  return raw
    .map(parseAttachment)
    .filter((a): a is Attachment => a !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function addAttachment(attachment: Attachment): Promise<void> {
  await redis().hset(keys.taskAttachments(attachment.taskId), { [attachment.id]: JSON.stringify(attachment) });
}

export async function getAttachment(taskId: string, attachmentId: string): Promise<Attachment | null> {
  return parseAttachment(await redis().hget(keys.taskAttachments(taskId), attachmentId));
}

export async function removeAttachment(taskId: string, attachmentId: string): Promise<void> {
  await redis().hdel(keys.taskAttachments(taskId), attachmentId);
}
