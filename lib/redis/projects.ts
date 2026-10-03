import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray, bool, num, oneOf, str, strOrNull, toHash, toRawHash, type RawHash } from "./serialize";
import { parseTimer, parseTimeSummary } from "./timeLogs";
import { purgeTasks } from "./tasks";
import { addMember, listAllMemberIds } from "./members";
import { ConflictError } from "@/lib/errors";
import { entryId } from "@/lib/search-terms";
import { newId } from "@/lib/utils";
import { PROJECT_COLORS, PROJECT_ICONS, PROJECT_ROLES, PROJECT_STATUSES, type ProgressStats, type Project } from "@/types/project";
import { TASK_STATUSES, type TaskStatus } from "@/types/task";
import type { TimeSummary } from "@/types/timer";
import type { User } from "@/types/user";

function parseProject(hash: RawHash): Project {
  return {
    id: str(hash, "id"),
    key: str(hash, "key"),
    name: str(hash, "name"),
    description: str(hash, "description"),
    icon: oneOf(hash.icon, PROJECT_ICONS, "folder"),
    color: oneOf(hash.color, PROJECT_COLORS, "slate"),
    status: oneOf(hash.status, PROJECT_STATUSES, "ACTIVE"),
    ownerId: str(hash, "ownerId"),
    startDate: strOrNull(hash, "startDate"),
    dueDate: strOrNull(hash, "dueDate"),
    allowViewerComments: bool(hash, "allowViewerComments"),
    createdAt: num(hash, "createdAt"),
    updatedAt: num(hash, "updatedAt"),
  };
}

export function parseStats(raw: unknown): ProgressStats {
  const hash = toRawHash(raw);
  if (!hash) return { total: 0, done: 0 };
  return { total: Math.max(0, num(hash, "total")), done: Math.max(0, num(hash, "done")) };
}

/** Per-status task counts kept in the same stats hash ("s:{STATUS}"). */
export function parseStatusCounts(raw: unknown): Record<TaskStatus, number> {
  const hash = toRawHash(raw) ?? {};
  return Object.fromEntries(TASK_STATUSES.map((s) => [s, Math.max(0, num(hash, `s:${s}`))])) as Record<TaskStatus, number>;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const hash = toRawHash(await redis().hgetall(keys.project(projectId)));
  return hash?.id ? parseProject(hash) : null;
}

export async function getProjects(projectIds: readonly string[]): Promise<Project[]> {
  if (projectIds.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of projectIds) pipe.hgetall(keys.project(id));
  const results = (await pipe.exec()) as unknown[];
  return results
    .map(toRawHash)
    .filter((h): h is RawHash => Boolean(h?.id))
    .map(parseProject);
}

/** Project ids the user belongs to, most recently joined first. Optionally a page. */
export async function listUserProjectIds(userId: string, offset = 0, limit?: number): Promise<string[]> {
  const stop = limit === undefined ? -1 : offset + limit - 1;
  return asStringArray(await redis().zrange(keys.userProjects(userId), offset, stop, { rev: true }));
}

export async function countUserProjects(userId: string): Promise<number> {
  return redis().zcard(keys.userProjects(userId));
}

/** Name, key and status of every project of a user, for filtering lists without loading full records. */
export async function listUserProjectHeaders(userId: string): Promise<Pick<Project, "id" | "name" | "key" | "status">[]> {
  const ids = await listUserProjectIds(userId);
  if (ids.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of ids) pipe.hmget(keys.project(id), "name", "key", "status");
  const rows = (await pipe.exec()) as unknown[];
  return ids.flatMap((id, i) => {
    const row = rows[i];
    const [name, key, status] = Array.isArray(row) ? row : row && typeof row === "object" ? Object.values(row) : [];
    if (typeof name !== "string" || !name) return [];
    return [{ id, name, key: String(key ?? ""), status: oneOf(String(status ?? ""), PROJECT_STATUSES, "ACTIVE") }];
  });
}

export interface ProjectSummary {
  stats: ProgressStats;
  statusCounts: Record<TaskStatus, number>;
  memberCount: number;
  /** First members alphabetically, for avatar stacks. */
  previewMemberIds: string[];
  trackedSeconds: number;
}

/** Progress, member count and preview, and tracked time for many projects in one round trip. */
export async function getProjectSummaries(projectIds: readonly string[], previewCount = 4): Promise<Map<string, ProjectSummary>> {
  const out = new Map<string, ProjectSummary>();
  if (projectIds.length === 0) return out;
  const pipe = redis().pipeline();
  for (const id of projectIds) {
    pipe.hgetall(keys.projectStats(id));
    pipe.hlen(keys.projectMembers(id));
    pipe.zrange(keys.projectMemberNames(id), "-", "+", { byLex: true, offset: 0, count: previewCount });
    pipe.hget(keys.projectTime(id), "total");
  }
  const results = (await pipe.exec()) as unknown[];
  projectIds.forEach((id, i) => {
    out.set(id, {
      stats: parseStats(results[i * 4]),
      statusCounts: parseStatusCounts(results[i * 4]),
      memberCount: Number(results[i * 4 + 1]) || 0,
      previewMemberIds: asStringArray(results[i * 4 + 2]).map(entryId),
      trackedSeconds: Number(results[i * 4 + 3]) || 0,
    });
  });
  return out;
}

export async function getProjectTime(projectId: string): Promise<TimeSummary> {
  return parseTimeSummary(await redis().hgetall(keys.projectTime(projectId)));
}

export interface CreateProjectInput {
  key: string;
  name: string;
  description: string;
  icon: Project["icon"];
  color: Project["color"];
  status: Project["status"];
  startDate: string | null;
  dueDate: string | null;
}

export async function createProject(input: CreateProjectInput, owner: Pick<User, "id" | "name" | "username" | "email">): Promise<Project> {
  const r = redis();
  const id = newId();
  const key = input.key.toUpperCase();
  if ((await r.set(keys.projectByKey(key), id, { nx: true })) !== "OK") {
    throw new ConflictError(`Kode proyek "${key}" sudah dipakai.`);
  }
  const now = Date.now();
  const project: Project = {
    id,
    key,
    name: input.name,
    description: input.description,
    icon: input.icon,
    color: input.color,
    status: input.status,
    ownerId: owner.id,
    startDate: input.startDate,
    dueDate: input.dueDate,
    allowViewerComments: false,
    createdAt: now,
    updatedAt: now,
  };
  const tx = r.multi();
  tx.hset(keys.project(id), toHash({ ...project }));
  tx.hset(keys.projectStats(id), { total: "0", done: "0" });
  await tx.exec();
  await addMember(id, owner, "OWNER", now);
  return project;
}

export type ProjectPatch = Partial<
  Pick<Project, "key" | "name" | "description" | "icon" | "color" | "status" | "startDate" | "dueDate" | "allowViewerComments">
>;

export async function updateProject(project: Project, patch: ProjectPatch): Promise<void> {
  const r = redis();
  const nextKey = patch.key?.toUpperCase();
  if (nextKey && nextKey !== project.key) {
    if ((await r.set(keys.projectByKey(nextKey), project.id, { nx: true })) !== "OK") {
      throw new ConflictError(`Kode proyek "${nextKey}" sudah dipakai.`);
    }
    await r.del(keys.projectByKey(project.key));
  }
  await r.hset(keys.project(project.id), toHash({ ...patch, ...(nextKey ? { key: nextKey } : {}), updatedAt: Date.now() }));
}

async function deleteInChunks(keyList: string[]): Promise<void> {
  const r = redis();
  for (let i = 0; i < keyList.length; i += 200) {
    const chunk = keyList.slice(i, i + 200);
    if (chunk.length > 0) await r.del(...chunk);
  }
}

/**
 * Hard-delete a project and everything below it: modules, sub modules,
 * tasks (with comments, time logs, attachment metadata, activity and every
 * per-user task index), search and member indexes, and membership. Timers
 * running on it are cleared. Stored files are removed by the caller.
 */
export async function deleteProjectCascade(project: Project): Promise<void> {
  const r = redis();
  const [memberIds, moduleIds, taskIds] = await Promise.all([
    listAllMemberIds(project.id),
    r.zrange(keys.projectModules(project.id), 0, -1),
    r.zrange(keys.projectTasks(project.id), 0, -1),
  ]);
  const modules = asStringArray(moduleIds);

  await purgeTasks(asStringArray(taskIds));

  const pipe = r.pipeline();
  for (const m of modules) pipe.zrange(keys.moduleSubModules(m), 0, -1);
  for (const u of memberIds) pipe.get(keys.userTimer(u));
  const results = modules.length + memberIds.length > 0 ? ((await pipe.exec()) as unknown[]) : [];
  const subModules = modules.flatMap((_, i) => asStringArray(results[i]));

  const toDelete: string[] = [];
  for (const m of modules) {
    toDelete.push(
      keys.module(m),
      keys.moduleSubModules(m),
      keys.moduleTasks(m),
      keys.moduleDirectTasks(m),
      keys.moduleStats(m),
      keys.moduleTime(m),
    );
  }
  for (const s of subModules) {
    toDelete.push(keys.subModule(s), keys.subModuleTasks(s), keys.subModuleStats(s), keys.subModuleTime(s));
  }
  const cleanup = r.pipeline();
  memberIds.forEach((userId, i) => {
    const timer = parseTimer(results[modules.length + i]);
    if (timer?.projectId === project.id) toDelete.push(keys.userTimer(userId));
    cleanup.zrem(keys.userProjects(userId), project.id);
  });
  toDelete.push(
    keys.project(project.id),
    keys.projectByKey(project.key),
    keys.projectMembers(project.id),
    keys.projectMemberNames(project.id),
    keys.projectMemberJoined(project.id),
    keys.projectMemberSearch(project.id),
    ...PROJECT_ROLES.map((role) => keys.projectMembersByRole(project.id, role)),
    ...TASK_STATUSES.map((status) => keys.projectStatus(project.id, status)),
    keys.projectOpenDue(project.id),
    keys.projectModules(project.id),
    keys.projectTasks(project.id),
    keys.projectDue(project.id),
    keys.projectStart(project.id),
    keys.projectStats(project.id),
    keys.projectTime(project.id),
    keys.projectTaskSeq(project.id),
    keys.projectActivities(project.id),
    keys.projectSearch(project.id),
    keys.legacyProjectSearch(project.id),
  );
  if (memberIds.length > 0) await cleanup.exec();
  await deleteInChunks(toDelete);
}
