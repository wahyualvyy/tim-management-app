import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray, num, numOrNull, oneOf, str, strOrNull, stringArray, toHash, toRawHash, type RawHash } from "./serialize";
import { searchMembers } from "./search";
import { parseTimer } from "./timeLogs";
import { isoDateToScore } from "@/lib/dates";
import { taskTerms } from "@/lib/search-terms";
import { newId } from "@/lib/utils";
import { TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskStatus } from "@/types/task";

/**
 * Task records and their indexes. Every list a page needs is an index that
 * can be paged without loading the whole project:
 *
 *   project:{p}:tasks            created time   (all tasks; cascades, scans)
 *   project:{p}:status:{S}       board order    (Kanban columns, status filter)
 *   project:{p}:due / :start     date           (calendar)
 *   project:{p}:open_due         due date       (overdue counts, attention list; not DONE)
 *   module:{m}:tasks             created time   (all tasks in the module)
 *   module:{m}:direct            created time   (tasks without sub module)
 *   submodule:{s}:tasks          created time
 *   user:{u}:tasks               created time   (all assigned)
 *   user:{u}:open                created time   (assigned, not DONE)
 *   user:{u}:open_due            due date       (assigned, not DONE, with due date)
 *   user:{u}:done                completed time (assigned, DONE)
 *   project:{p}:stats            total, done, s:{STATUS} counters (also per module / sub module)
 */

export function parseTask(hash: RawHash): Task {
  return {
    id: str(hash, "id"),
    projectId: str(hash, "projectId"),
    moduleId: str(hash, "moduleId"),
    subModuleId: strOrNull(hash, "subModuleId"),
    number: num(hash, "number"),
    title: str(hash, "title"),
    description: str(hash, "description"),
    status: oneOf(hash.status, TASK_STATUSES, "TODO"),
    priority: oneOf(hash.priority, TASK_PRIORITIES, "MEDIUM"),
    assigneeIds: stringArray(hash.assigneeIds),
    creatorId: str(hash, "creatorId"),
    startDate: strOrNull(hash, "startDate"),
    dueDate: strOrNull(hash, "dueDate"),
    labels: stringArray(hash.labels),
    estimatedMinutes: numOrNull(hash, "estimatedMinutes"),
    trackedSeconds: Math.max(0, num(hash, "trackedSeconds")),
    completionNotes: str(hash, "completionNotes"),
    completedAt: numOrNull(hash, "completedAt"),
    order: num(hash, "order"),
    createdAt: num(hash, "createdAt"),
    updatedAt: num(hash, "updatedAt"),
  };
}

/** A hash missing core fields is a stub (e.g. a counter written after deletion), not a task. */
function parseIfComplete(raw: unknown): Task | null {
  const hash = toRawHash(raw);
  return hash && hash.id && hash.projectId ? parseTask(hash) : null;
}

export async function getTask(taskId: string): Promise<Task | null> {
  return parseIfComplete(await redis().hgetall(keys.task(taskId)));
}

/** Batch load; preserves the order of `taskIds` and skips missing records. */
export async function getTasks(taskIds: readonly string[]): Promise<Task[]> {
  if (taskIds.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of taskIds) pipe.hgetall(keys.task(id));
  const results = (await pipe.exec()) as unknown[];
  return results.map(parseIfComplete).filter((t): t is Task => t !== null);
}

export async function listProjectTaskIds(projectId: string): Promise<string[]> {
  return asStringArray(await redis().zrange(keys.projectTasks(projectId), 0, -1));
}

const dueScore = (task: Pick<Task, "dueDate">) => (task.dueDate ? isoDateToScore(task.dueDate) : null);

/** A page of ids from any task index. */
export async function pageIndex(key: string, offset: number, limit: number, rev: boolean): Promise<{ ids: string[]; hasMore: boolean }> {
  const ids = asStringArray(await redis().zrange(key, offset, offset + limit, { rev }));
  return { ids: ids.slice(0, limit), hasMore: ids.length > limit };
}

export interface BoardColumn {
  status: TaskStatus;
  tasks: Task[];
  total: number;
}

/** The first `perColumn` cards of every Kanban column and each column's size, in two round trips. */
export async function listBoard(projectId: string, perColumn: number): Promise<BoardColumn[]> {
  const pipe = redis().pipeline();
  for (const s of TASK_STATUSES) {
    pipe.zrange(keys.projectStatus(projectId, s), 0, perColumn - 1);
    pipe.zcard(keys.projectStatus(projectId, s));
  }
  const results = (await pipe.exec()) as unknown[];
  const idLists = TASK_STATUSES.map((_, i) => asStringArray(results[i * 2]));
  const tasks = new Map((await getTasks(idLists.flat())).map((t) => [t.id, t]));
  return TASK_STATUSES.map((status, i) => ({
    status,
    total: Number(results[i * 2 + 1]) || 0,
    tasks: (idLists[i] ?? []).flatMap((id) => {
      const t = tasks.get(id);
      return t ? [t] : [];
    }),
  }));
}

/**
 * Tasks for a filtered board (module, sub module and/or "mine"). Reads the
 * narrowest index, newest first, and stops at `limit`; `truncated` tells the
 * page to say that only part of the result is shown.
 */
export async function listFilteredTasks(
  projectId: string,
  filter: { moduleId?: string; subModuleId?: string; userId?: string },
  limit: number,
): Promise<{ tasks: Task[]; truncated: boolean }> {
  const key = filter.subModuleId
    ? keys.subModuleTasks(filter.subModuleId)
    : filter.moduleId
      ? keys.moduleTasks(filter.moduleId)
      : filter.userId
        ? keys.userTasks(filter.userId)
        : keys.projectTasks(projectId);
  const { ids, hasMore } = await pageIndex(key, 0, limit, true);
  const tasks = (await getTasks(ids)).filter(
    (t) =>
      t.projectId === projectId &&
      (!filter.moduleId || t.moduleId === filter.moduleId) &&
      (!filter.subModuleId || t.subModuleId === filter.subModuleId) &&
      (!filter.userId || t.assigneeIds.includes(filter.userId)),
  );
  return { tasks, truncated: hasMore };
}

export async function listColumnPage(projectId: string, status: TaskStatus, offset: number, limit: number): Promise<{ tasks: Task[]; hasMore: boolean }> {
  const { ids, hasMore } = await pageIndex(keys.projectStatus(projectId, status), offset, limit, false);
  return { tasks: await getTasks(ids), hasMore };
}

/** Tasks of a sub module, or directly under a module when `subModuleId` is null. */
export async function listNodeTasks(moduleId: string, subModuleId: string | null, offset: number, limit: number) {
  const key = subModuleId ? keys.subModuleTasks(subModuleId) : keys.moduleDirectTasks(moduleId);
  const { ids, hasMore } = await pageIndex(key, offset, limit, false);
  return { tasks: await getTasks(ids), hasMore };
}

export async function countOverdue(projectId: string, today: string): Promise<number> {
  return redis().zcount(keys.projectOpenDue(projectId), "-inf", `(${isoDateToScore(today)}`);
}

/** Open tasks with the earliest due dates. */
export async function listOpenByDue(projectId: string, limit: number): Promise<Task[]> {
  return getTasks(asStringArray(await redis().zrange(keys.projectOpenDue(projectId), 0, limit - 1)));
}

export interface UserTaskCounts {
  open: number;
  overdue: number;
  doneSince: number;
}

export async function getUserTaskCounts(userId: string, today: string, doneSince: number): Promise<UserTaskCounts> {
  const pipe = redis().pipeline();
  pipe.zcard(keys.userOpenTasks(userId));
  pipe.zcount(keys.userOpenDue(userId), "-inf", `(${isoDateToScore(today)}`);
  pipe.zcount(keys.userDoneTasks(userId), doneSince, "+inf");
  const [open, overdue, done] = (await pipe.exec()) as unknown[];
  return { open: Number(open) || 0, overdue: Number(overdue) || 0, doneSince: Number(done) || 0 };
}

/** Assigned open tasks due between two dates (inclusive, ISO), earliest first. */
export async function listUserDueBetween(userId: string, from: string | null, to: string, limit: number): Promise<Task[]> {
  const min = from ? isoDateToScore(from) : "-inf";
  const ids = asStringArray(await redis().zrange(keys.userOpenDue(userId), min, isoDateToScore(to), { byScore: true, offset: 0, count: limit }));
  return getTasks(ids);
}

export async function listUserOpenPage(userId: string, offset: number, limit: number) {
  const { ids, hasMore } = await pageIndex(keys.userOpenTasks(userId), offset, limit, true);
  return { tasks: await getTasks(ids), hasMore };
}

export async function listUserDone(userId: string, limit: number): Promise<Task[]> {
  return getTasks(asStringArray(await redis().zrange(keys.userDoneTasks(userId), 0, limit - 1, { rev: true })));
}

/** Tasks with a due or start date inside [from, to] (ISO dates), at most `perProject` of each per project. */
export async function listScheduledTasks(projectIds: readonly string[], from: string, to: string, perProject = 200): Promise<Task[]> {
  if (projectIds.length === 0) return [];
  const min = isoDateToScore(from);
  const max = isoDateToScore(to);
  const pipe = redis().pipeline();
  for (const id of projectIds) {
    pipe.zrange(keys.projectDue(id), min, max, { byScore: true, offset: 0, count: perProject });
    pipe.zrange(keys.projectStart(id), min, max, { byScore: true, offset: 0, count: perProject });
  }
  const results = (await pipe.exec()) as unknown[];
  return getTasks([...new Set(results.flatMap(asStringArray))]);
}

/** The progress-counter keys a task counts toward. */
function statsKeys(task: Pick<Task, "projectId" | "moduleId" | "subModuleId">): string[] {
  return [keys.projectStats(task.projectId), keys.moduleStats(task.moduleId), ...(task.subModuleId ? [keys.subModuleStats(task.subModuleId)] : [])];
}

function searchEntries(task: Pick<Task, "id" | "title" | "labels">, ref: string): string[] {
  return searchMembers("task", task.id, taskTerms(task, ref));
}

export interface CreateTaskInput {
  projectId: string;
  moduleId: string;
  subModuleId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Task["priority"];
  assigneeIds: string[];
  startDate: string | null;
  dueDate: string | null;
  labels: string[];
  estimatedMinutes: number | null;
  /** Board position; defaults to the end of the column. */
  order?: number;
}

/**
 * Create a task and every index that points at it in one transaction:
 * structure lists and counters, board column, assignee indexes, calendar
 * and due indexes, watchers and the search index.
 */
export async function createTask(input: CreateTaskInput, creatorId: string, projectKey: string): Promise<Task> {
  const r = redis();
  const id = newId();
  const number = await r.incr(keys.projectTaskSeq(input.projectId));
  const now = Date.now();
  const done = input.status === "DONE";
  const task: Task = {
    ...input,
    id,
    number,
    creatorId,
    trackedSeconds: 0,
    completionNotes: "",
    completedAt: done ? now : null,
    order: input.order ?? now,
    createdAt: now,
    updatedAt: now,
  };
  const due = dueScore(task);
  const tx = r.multi();
  tx.hset(keys.task(id), toHash({ ...task }));
  tx.zadd(keys.projectTasks(task.projectId), { score: now, member: id });
  tx.zadd(keys.projectStatus(task.projectId, task.status), { score: task.order, member: id });
  tx.zadd(keys.moduleTasks(task.moduleId), { score: now, member: id });
  if (task.subModuleId) tx.zadd(keys.subModuleTasks(task.subModuleId), { score: now, member: id });
  else tx.zadd(keys.moduleDirectTasks(task.moduleId), { score: now, member: id });
  for (const key of statsKeys(task)) {
    tx.hincrby(key, "total", 1);
    tx.hincrby(key, `s:${task.status}`, 1);
    if (done) tx.hincrby(key, "done", 1);
  }
  for (const userId of task.assigneeIds) {
    tx.zadd(keys.userTasks(userId), { score: now, member: id });
    if (done) tx.zadd(keys.userDoneTasks(userId), { score: now, member: id });
    else {
      tx.zadd(keys.userOpenTasks(userId), { score: now, member: id });
      if (due !== null) tx.zadd(keys.userOpenDue(userId), { score: due, member: id });
    }
  }
  if (due !== null) {
    tx.zadd(keys.projectDue(task.projectId), { score: due, member: id });
    if (!done) tx.zadd(keys.projectOpenDue(task.projectId), { score: due, member: id });
  }
  if (task.startDate) tx.zadd(keys.projectStart(task.projectId), { score: isoDateToScore(task.startDate), member: id });
  tx.sadd(keys.taskWatchers(id), creatorId, ...task.assigneeIds);
  for (const member of searchEntries(task, `${projectKey}-${number}`)) {
    tx.zadd(keys.projectSearch(task.projectId), { score: 0, member });
  }
  await tx.exec();
  return task;
}

/**
 * Atomic status change and/or board position. The script reads the current
 * status, moves the task between column indexes, adjusts per-status and
 * "done" counters only when the status really changes (so concurrent drags
 * cannot double count), and keeps the open/due/done indexes of the project
 * and every assignee in step.
 *
 * KEYS: 1 task · 2-4 stats (project, module, sub module or module again)
 *       5-9 column indexes in TASK_STATUSES order · 10 project open_due
 *       11.. per assignee: open, open_due, done
 * ARGV: 1 status · 2 now · 3 order or "" · 4 has sub module · 5 due score or ""
 *       6 created time · 7 task id
 */
const SET_STATUS_SCRIPT = `
local old = redis.call('HGET', KEYS[1], 'status')
if not old then return false end
local statuses = {'TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE'}
local function column(s)
  for i, v in ipairs(statuses) do if v == s then return KEYS[4 + i] end end
  return nil
end
local id = ARGV[7]
local order = ARGV[3]
if order == '' then
  order = redis.call('HGET', KEYS[1], 'order') or ARGV[2]
else
  redis.call('HSET', KEYS[1], 'order', order)
end
if old == ARGV[1] then
  local k = column(old)
  if k then redis.call('ZADD', k, order, id) end
  if ARGV[3] ~= '' then redis.call('HSET', KEYS[1], 'updatedAt', ARGV[2]) end
  return old
end
redis.call('HSET', KEYS[1], 'status', ARGV[1], 'updatedAt', ARGV[2])
local from = column(old)
if from then redis.call('ZREM', from, id) end
redis.call('ZADD', column(ARGV[1]), order, id)
local last = 3
if ARGV[4] == '1' then last = 4 end
for i = 2, last do
  redis.call('HINCRBY', KEYS[i], 's:' .. old, -1)
  redis.call('HINCRBY', KEYS[i], 's:' .. ARGV[1], 1)
end
if ARGV[1] == 'DONE' then
  redis.call('HSET', KEYS[1], 'completedAt', ARGV[2])
  for i = 2, last do redis.call('HINCRBY', KEYS[i], 'done', 1) end
  redis.call('ZREM', KEYS[10], id)
  local i = 11
  while i + 2 <= #KEYS do
    redis.call('ZREM', KEYS[i], id)
    redis.call('ZREM', KEYS[i + 1], id)
    redis.call('ZADD', KEYS[i + 2], ARGV[2], id)
    i = i + 3
  end
elseif old == 'DONE' then
  redis.call('HSET', KEYS[1], 'completedAt', '')
  for i = 2, last do redis.call('HINCRBY', KEYS[i], 'done', -1) end
  if ARGV[5] ~= '' then redis.call('ZADD', KEYS[10], ARGV[5], id) end
  local i = 11
  while i + 2 <= #KEYS do
    redis.call('ZADD', KEYS[i], ARGV[6], id)
    if ARGV[5] ~= '' then redis.call('ZADD', KEYS[i + 1], ARGV[5], id) end
    redis.call('ZREM', KEYS[i + 2], id)
    i = i + 3
  end
end
return old
`;

export async function setTaskStatus(task: Task, status: TaskStatus, order?: number): Promise<TaskStatus | null> {
  const due = dueScore(task);
  const scriptKeys = [
    keys.task(task.id),
    keys.projectStats(task.projectId),
    keys.moduleStats(task.moduleId),
    task.subModuleId ? keys.subModuleStats(task.subModuleId) : keys.moduleStats(task.moduleId),
    ...TASK_STATUSES.map((s) => keys.projectStatus(task.projectId, s)),
    keys.projectOpenDue(task.projectId),
    ...task.assigneeIds.flatMap((u) => [keys.userOpenTasks(u), keys.userOpenDue(u), keys.userDoneTasks(u)]),
  ];
  const result = await redis().eval<string[], unknown>(SET_STATUS_SCRIPT, scriptKeys, [
    status,
    String(Date.now()),
    order === undefined ? "" : String(order),
    task.subModuleId ? "1" : "0",
    due === null ? "" : String(due),
    String(task.createdAt),
    task.id,
  ]);
  return typeof result === "string" ? oneOf(result, TASK_STATUSES, "TODO") : null;
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "priority"
    | "assigneeIds"
    | "startDate"
    | "dueDate"
    | "labels"
    | "estimatedMinutes"
    | "completionNotes"
    | "moduleId"
    | "subModuleId"
  >
>;

/**
 * Update non-status fields and keep every secondary index in sync. Moving a
 * task to another module or sub module also moves its progress counts and
 * its tracked time (per user) between the aggregates.
 */
export async function updateTask(task: Task, patch: TaskPatch, projectKey: string): Promise<Task> {
  const r = redis();
  const next: Task = { ...task, ...patch, updatedAt: Date.now() };
  const done = task.status === "DONE";
  const moved = next.moduleId !== task.moduleId || next.subModuleId !== task.subModuleId;
  const taskTime = moved ? (toRawHash(await r.hgetall(keys.taskTime(task.id))) ?? {}) : {};
  const oldDue = dueScore(task);
  const newDue = dueScore(next);
  const dueChanged = oldDue !== newDue;

  const tx = r.multi();
  tx.hset(keys.task(task.id), toHash({ ...patch, updatedAt: next.updatedAt }));

  const before = new Set(task.assigneeIds);
  const after = new Set(next.assigneeIds);
  for (const id of before) {
    if (after.has(id)) continue;
    tx.zrem(keys.userTasks(id), task.id);
    tx.zrem(keys.userOpenTasks(id), task.id);
    tx.zrem(keys.userOpenDue(id), task.id);
    tx.zrem(keys.userDoneTasks(id), task.id);
  }
  for (const id of after) {
    const added = !before.has(id);
    if (added) {
      tx.zadd(keys.userTasks(id), { score: task.createdAt, member: task.id });
      tx.sadd(keys.taskWatchers(task.id), id);
      if (done) tx.zadd(keys.userDoneTasks(id), { score: task.completedAt ?? Date.now(), member: task.id });
      else tx.zadd(keys.userOpenTasks(id), { score: task.createdAt, member: task.id });
    }
    if (!done && (added || dueChanged)) {
      if (newDue !== null) tx.zadd(keys.userOpenDue(id), { score: newDue, member: task.id });
      else tx.zrem(keys.userOpenDue(id), task.id);
    }
  }
  if (dueChanged) {
    if (newDue !== null) {
      tx.zadd(keys.projectDue(task.projectId), { score: newDue, member: task.id });
      if (!done) tx.zadd(keys.projectOpenDue(task.projectId), { score: newDue, member: task.id });
    } else {
      tx.zrem(keys.projectDue(task.projectId), task.id);
      tx.zrem(keys.projectOpenDue(task.projectId), task.id);
    }
  }
  if (patch.startDate !== undefined && patch.startDate !== task.startDate) {
    if (next.startDate) tx.zadd(keys.projectStart(task.projectId), { score: isoDateToScore(next.startDate), member: task.id });
    else tx.zrem(keys.projectStart(task.projectId), task.id);
  }
  if (moved) {
    const oldTime = [keys.moduleTime(task.moduleId), ...(task.subModuleId ? [keys.subModuleTime(task.subModuleId)] : [])];
    const newTime = [keys.moduleTime(next.moduleId), ...(next.subModuleId ? [keys.subModuleTime(next.subModuleId)] : [])];
    const oldStats = [keys.moduleStats(task.moduleId), ...(task.subModuleId ? [keys.subModuleStats(task.subModuleId)] : [])];
    const newStats = [keys.moduleStats(next.moduleId), ...(next.subModuleId ? [keys.subModuleStats(next.subModuleId)] : [])];
    if (next.moduleId !== task.moduleId) {
      tx.zrem(keys.moduleTasks(task.moduleId), task.id);
      tx.zadd(keys.moduleTasks(next.moduleId), { score: task.createdAt, member: task.id });
    }
    if (task.subModuleId) tx.zrem(keys.subModuleTasks(task.subModuleId), task.id);
    else tx.zrem(keys.moduleDirectTasks(task.moduleId), task.id);
    if (next.subModuleId) tx.zadd(keys.subModuleTasks(next.subModuleId), { score: task.createdAt, member: task.id });
    else tx.zadd(keys.moduleDirectTasks(next.moduleId), { score: task.createdAt, member: task.id });
    for (const key of oldStats) {
      tx.hincrby(key, "total", -1);
      tx.hincrby(key, `s:${task.status}`, -1);
      if (done) tx.hincrby(key, "done", -1);
    }
    for (const key of newStats) {
      tx.hincrby(key, "total", 1);
      tx.hincrby(key, `s:${task.status}`, 1);
      if (done) tx.hincrby(key, "done", 1);
    }
    for (const [field, value] of Object.entries(taskTime)) {
      const seconds = Number(value) || 0;
      if (seconds === 0) continue;
      for (const key of oldTime) tx.hincrby(key, field, -seconds);
      for (const key of newTime) tx.hincrby(key, field, seconds);
    }
  }
  if (patch.title !== undefined || patch.labels !== undefined) {
    const ref = `${projectKey}-${task.number}`;
    const oldEntries = searchEntries(task, ref);
    const newEntries = searchEntries(next, ref);
    const removed = oldEntries.filter((e) => !newEntries.includes(e));
    if (removed.length > 0) tx.zrem(keys.projectSearch(task.projectId), ...removed);
    for (const member of newEntries) tx.zadd(keys.projectSearch(task.projectId), { score: 0, member });
  }
  await tx.exec();
  return next;
}

/** Per-task data that must be removed with it, gathered in one round trip. */
async function collectChildren(taskIds: readonly string[]) {
  const r = redis();
  const pipe = r.pipeline();
  for (const id of taskIds) {
    pipe.zrange(keys.taskComments(id), 0, -1);
    pipe.zrange(keys.taskTimeLogs(id), 0, -1);
    pipe.smembers(keys.taskTimers(id));
  }
  const results = taskIds.length > 0 ? ((await pipe.exec()) as unknown[]) : [];
  const perTask = taskIds.map((id, i) => ({
    id,
    commentIds: asStringArray(results[i * 3]),
    logIds: asStringArray(results[i * 3 + 1]),
    timerUsers: asStringArray(results[i * 3 + 2]),
  }));
  const logIds = perTask.flatMap((t) => t.logIds);
  const timerUsers = [...new Set(perTask.flatMap((t) => t.timerUsers))];
  const ownerPipe = r.pipeline();
  for (const id of logIds) ownerPipe.hget(keys.timeLog(id), "userId");
  for (const u of timerUsers) ownerPipe.get(keys.userTimer(u));
  const ownerResults = logIds.length + timerUsers.length > 0 ? ((await ownerPipe.exec()) as unknown[]) : [];
  const logOwner = new Map<string, string>();
  logIds.forEach((id, i) => {
    const owner = ownerResults[i];
    if (typeof owner === "string" && owner) logOwner.set(id, owner);
  });
  const timers = timerUsers.map((u, i) => ({ userId: u, timer: parseTimer(ownerResults[logIds.length + i]) }));
  return { perTask, logOwner, timers };
}

function taskOwnKeys(taskId: string): string[] {
  return [
    keys.task(taskId),
    keys.taskComments(taskId),
    keys.taskTimeLogs(taskId),
    keys.taskTime(taskId),
    keys.taskAttachments(taskId),
    keys.taskActivities(taskId),
    keys.taskWatchers(taskId),
    keys.taskTimers(taskId),
  ];
}

/**
 * Delete one task and its dependent data, adjusting counters, time
 * aggregates and every index. Removing it from the project index first acts
 * as a lock: only the caller that actually removed it continues.
 */
export async function deleteTask(task: Task, projectKey: string): Promise<boolean> {
  const r = redis();
  if ((await r.zrem(keys.projectTasks(task.projectId), task.id)) === 0) return false;
  const [{ perTask, logOwner, timers }, timeRaw] = await Promise.all([collectChildren([task.id]), r.hgetall(keys.taskTime(task.id))]);
  const children = perTask[0];
  const taskTime = toRawHash(timeRaw) ?? {};

  const tx = r.multi();
  tx.zrem(keys.moduleTasks(task.moduleId), task.id);
  if (task.subModuleId) tx.zrem(keys.subModuleTasks(task.subModuleId), task.id);
  else tx.zrem(keys.moduleDirectTasks(task.moduleId), task.id);
  tx.zrem(keys.projectStatus(task.projectId, task.status), task.id);
  tx.zrem(keys.projectDue(task.projectId), task.id);
  tx.zrem(keys.projectOpenDue(task.projectId), task.id);
  tx.zrem(keys.projectStart(task.projectId), task.id);
  for (const key of statsKeys(task)) {
    tx.hincrby(key, "total", -1);
    tx.hincrby(key, `s:${task.status}`, -1);
    if (task.status === "DONE") tx.hincrby(key, "done", -1);
  }
  const timeKeys = [keys.projectTime(task.projectId), keys.moduleTime(task.moduleId), ...(task.subModuleId ? [keys.subModuleTime(task.subModuleId)] : [])];
  for (const [field, value] of Object.entries(taskTime)) {
    const seconds = Number(value) || 0;
    if (seconds) for (const key of timeKeys) tx.hincrby(key, field, -seconds);
  }
  for (const userId of task.assigneeIds) {
    tx.zrem(keys.userTasks(userId), task.id);
    tx.zrem(keys.userOpenTasks(userId), task.id);
    tx.zrem(keys.userOpenDue(userId), task.id);
    tx.zrem(keys.userDoneTasks(userId), task.id);
  }
  const entries = searchEntries(task, `${projectKey}-${task.number}`);
  if (entries.length > 0) tx.zrem(keys.projectSearch(task.projectId), ...entries);
  for (const logId of children?.logIds ?? []) {
    const owner = logOwner.get(logId);
    if (owner) tx.zrem(keys.userTimeLogs(owner), logId);
    tx.del(keys.timeLog(logId));
  }
  for (const c of children?.commentIds ?? []) tx.del(keys.comment(c));
  for (const { userId, timer } of timers) {
    if (timer?.taskId === task.id) tx.del(keys.userTimer(userId));
  }
  tx.del(...taskOwnKeys(task.id));
  await tx.exec();
  return true;
}

/**
 * Bulk removal used when a whole project is deleted: removes the tasks and
 * everything hanging off them, including per-user indexes. Project, module
 * and sub module aggregates are not adjusted because they are deleted too.
 */
export async function purgeTasks(taskIds: readonly string[]): Promise<void> {
  const r = redis();
  for (let start = 0; start < taskIds.length; start += 100) {
    const batch = taskIds.slice(start, start + 100);
    const [{ perTask, logOwner, timers }, assigneeRows] = await Promise.all([
      collectChildren(batch),
      (async () => {
        const pipe = r.pipeline();
        for (const id of batch) pipe.hget(keys.task(id), "assigneeIds");
        return batch.length > 0 ? ((await pipe.exec()) as unknown[]) : [];
      })(),
    ]);
    const batchSet = new Set(batch);
    const tx = r.multi();
    batch.forEach((taskId, i) => {
      for (const userId of stringArray(typeof assigneeRows[i] === "string" ? (assigneeRows[i] as string) : undefined)) {
        tx.zrem(keys.userTasks(userId), taskId);
        tx.zrem(keys.userOpenTasks(userId), taskId);
        tx.zrem(keys.userOpenDue(userId), taskId);
        tx.zrem(keys.userDoneTasks(userId), taskId);
      }
    });
    for (const t of perTask) {
      for (const logId of t.logIds) {
        const owner = logOwner.get(logId);
        if (owner) tx.zrem(keys.userTimeLogs(owner), logId);
        tx.del(keys.timeLog(logId));
      }
      for (const c of t.commentIds) tx.del(keys.comment(c));
      tx.del(...taskOwnKeys(t.id));
    }
    for (const { userId, timer } of timers) {
      if (timer && batchSet.has(timer.taskId)) tx.del(keys.userTimer(userId));
    }
    await tx.exec();
  }
}

export async function getWatchers(taskId: string): Promise<string[]> {
  return asStringArray(await redis().smembers(keys.taskWatchers(taskId)));
}

export async function addWatcher(taskId: string, userId: string): Promise<void> {
  await redis().sadd(keys.taskWatchers(taskId), userId);
}
