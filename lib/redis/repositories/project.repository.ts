import "server-only";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { asStringArray, bool, num, oneOf, str, strOrNull, toHash, toRawHash, type RawHash } from "@/lib/redis/serialize";
import { parseTimer } from "@/lib/redis/repositories/timer.repository";
import { ConflictError } from "@/lib/errors";
import { newId } from "@/lib/utils";
import {
  PROJECT_ICONS,
  PROJECT_ROLES,
  PROJECT_STATUSES,
  type ProgressStats,
  type Project,
  type ProjectMember,
  type ProjectRole,
} from "@/types/project";

function parseProject(hash: RawHash): Project {
  return {
    id: str(hash, "id"),
    key: str(hash, "key"),
    name: str(hash, "name"),
    description: str(hash, "description"),
    icon: oneOf(hash.icon, PROJECT_ICONS, "folder"),
    status: oneOf(hash.status, PROJECT_STATUSES, "ACTIVE"),
    ownerId: str(hash, "ownerId"),
    startDate: strOrNull(hash, "startDate"),
    targetDate: strOrNull(hash, "targetDate"),
    archived: bool(hash, "archived"),
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

export async function getProject(projectId: string): Promise<Project | null> {
  const hash = toRawHash(await redis().hgetall(keys.project(projectId)));
  return hash ? parseProject(hash) : null;
}

export async function getProjects(projectIds: readonly string[]): Promise<Project[]> {
  if (projectIds.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of projectIds) pipe.hgetall(keys.project(id));
  const results = (await pipe.exec()) as unknown[];
  return results.map(toRawHash).filter((h): h is RawHash => h !== null).map(parseProject);
}

/** Project ids the user belongs to, most recently joined first. */
export async function listUserProjectIds(userId: string): Promise<string[]> {
  return asStringArray(await redis().zrange(keys.userProjects(userId), 0, -1, { rev: true }));
}

export async function getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const role = await redis().hget<string>(keys.projectMembers(projectId), userId);
  return role && (PROJECT_ROLES as readonly string[]).includes(role) ? (role as ProjectRole) : null;
}

export async function getMembers(projectId: string): Promise<ProjectMember[]> {
  const hash = toRawHash(await redis().hgetall(keys.projectMembers(projectId)));
  if (!hash) return [];
  return Object.entries(hash)
    .filter(([, role]) => (PROJECT_ROLES as readonly string[]).includes(role))
    .map(([userId, role]) => ({ userId, role: role as ProjectRole }));
}

/** Summary data for many projects in one round trip: stats, member counts and the viewer's role. */
export async function getProjectSummaries(
  projectIds: readonly string[],
  userId: string,
): Promise<Map<string, { stats: ProgressStats; memberCount: number; role: ProjectRole | null }>> {
  const out = new Map<string, { stats: ProgressStats; memberCount: number; role: ProjectRole | null }>();
  if (projectIds.length === 0) return out;
  const pipe = redis().pipeline();
  for (const id of projectIds) {
    pipe.hgetall(keys.projectStats(id));
    pipe.hlen(keys.projectMembers(id));
    pipe.hget(keys.projectMembers(id), userId);
  }
  const results = (await pipe.exec()) as unknown[];
  projectIds.forEach((id, i) => {
    const roleRaw = results[i * 3 + 2];
    const role =
      typeof roleRaw === "string" && (PROJECT_ROLES as readonly string[]).includes(roleRaw)
        ? (roleRaw as ProjectRole)
        : null;
    out.set(id, {
      stats: parseStats(results[i * 3]),
      memberCount: Number(results[i * 3 + 1]) || 0,
      role,
    });
  });
  return out;
}

export interface CreateProjectInput {
  key: string;
  name: string;
  description: string;
  icon: Project["icon"];
  status: Project["status"];
  startDate: string | null;
  targetDate: string | null;
}

export async function createProject(input: CreateProjectInput, ownerId: string): Promise<Project> {
  const r = redis();
  const id = newId();
  const key = input.key.toUpperCase();
  const claimed = await r.set(keys.projectByKey(key), id, { nx: true });
  if (claimed !== "OK") throw new ConflictError(`The project key "${key}" is already in use.`);

  const now = Date.now();
  const project: Project = {
    id,
    key,
    name: input.name,
    description: input.description,
    icon: input.icon,
    status: input.status,
    ownerId,
    startDate: input.startDate,
    targetDate: input.targetDate,
    archived: false,
    allowViewerComments: false,
    createdAt: now,
    updatedAt: now,
  };
  const tx = r.multi();
  tx.hset(keys.project(id), toHash({ ...project }));
  tx.hset(keys.projectMembers(id), { [ownerId]: "OWNER" });
  tx.hset(keys.projectStats(id), { total: "0", done: "0" });
  tx.zadd(keys.userProjects(ownerId), { score: now, member: id });
  await tx.exec();
  return project;
}

export type ProjectPatch = Partial<
  Pick<
    Project,
    | "key"
    | "name"
    | "description"
    | "icon"
    | "status"
    | "startDate"
    | "targetDate"
    | "archived"
    | "allowViewerComments"
    | "ownerId"
  >
>;

export async function updateProject(project: Project, patch: ProjectPatch): Promise<void> {
  const r = redis();
  const nextKey = patch.key?.toUpperCase();
  if (nextKey && nextKey !== project.key) {
    const claimed = await r.set(keys.projectByKey(nextKey), project.id, { nx: true });
    if (claimed !== "OK") throw new ConflictError(`The project key "${nextKey}" is already in use.`);
    await r.del(keys.projectByKey(project.key));
  }
  await r.hset(
    keys.project(project.id),
    toHash({ ...patch, ...(nextKey ? { key: nextKey } : {}), updatedAt: Date.now() }),
  );
}

export async function addMember(projectId: string, userId: string, role: ProjectRole): Promise<void> {
  const tx = redis().multi();
  tx.hset(keys.projectMembers(projectId), { [userId]: role });
  tx.zadd(keys.userProjects(userId), { score: Date.now(), member: projectId });
  await tx.exec();
}

export async function setMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<void> {
  await redis().hset(keys.projectMembers(projectId), { [userId]: role });
}

/** Removes membership and unassigns the member's tasks in this project. */
export async function removeMember(projectId: string, userId: string): Promise<void> {
  const r = redis();
  const taskIds = asStringArray(await r.zrange(keys.projectTasks(projectId), 0, -1));
  const assignedHere: string[] = [];
  if (taskIds.length > 0) {
    const pipe = r.pipeline();
    for (const id of taskIds) pipe.hget(keys.task(id), "assigneeId");
    const assignees = (await pipe.exec()) as unknown[];
    taskIds.forEach((id, i) => {
      if (assignees[i] === userId) assignedHere.push(id);
    });
  }
  const timer = parseTimer(await r.get<string>(keys.activeTimer(userId)));
  const tx = r.multi();
  tx.hdel(keys.projectMembers(projectId), userId);
  tx.zrem(keys.userProjects(userId), projectId);
  // A removed member can no longer track time here; drop their running timer.
  if (timer?.projectId === projectId) tx.del(keys.activeTimer(userId));
  for (const taskId of assignedHere) {
    tx.hset(keys.task(taskId), { assigneeId: "" });
    tx.zrem(keys.userAssigned(userId), taskId);
  }
  await tx.exec();
}

async function deleteInChunks(keyList: string[]): Promise<void> {
  const r = redis();
  for (let i = 0; i < keyList.length; i += 200) {
    const chunk = keyList.slice(i, i + 200);
    if (chunk.length > 0) await r.del(...chunk);
  }
}

/**
 * Hard-delete a project and everything that belongs to it: modules, tasks,
 * comments, time logs, attachments metadata, activity, search index,
 * membership and per-user indexes. Active timers on its tasks are cleared.
 */
export async function deleteProjectCascade(project: Project): Promise<void> {
  const r = redis();
  const [memberHash, moduleIds, taskIds] = await Promise.all([
    r.hgetall(keys.projectMembers(project.id)),
    r.zrange(keys.projectModules(project.id), 0, -1),
    r.zrange(keys.projectTasks(project.id), 0, -1),
  ]);
  const memberIds = Object.keys(toRawHash(memberHash) ?? {});
  const modules = asStringArray(moduleIds);
  const tasks = asStringArray(taskIds);

  // Collect child ids of each task in one round trip.
  const childPipe = r.pipeline();
  for (const taskId of tasks) {
    childPipe.zrange(keys.taskComments(taskId), 0, -1);
    childPipe.zrange(keys.taskTimeLogs(taskId), 0, -1);
    childPipe.hget(keys.task(taskId), "assigneeId");
  }
  for (const userId of memberIds) childPipe.get(keys.activeTimer(userId));
  const childResults = tasks.length + memberIds.length > 0 ? ((await childPipe.exec()) as unknown[]) : [];

  const toDelete: string[] = [];
  const cleanup = r.pipeline();
  let cleanupOps = 0;
  tasks.forEach((taskId, i) => {
    const commentIds = asStringArray(childResults[i * 3]);
    const logIds = asStringArray(childResults[i * 3 + 1]);
    const assignee = childResults[i * 3 + 2];
    for (const c of commentIds) toDelete.push(keys.comment(c));
    for (const l of logIds) toDelete.push(keys.timeLog(l));
    toDelete.push(
      keys.task(taskId),
      keys.taskComments(taskId),
      keys.taskTimeLogs(taskId),
      keys.taskAttachments(taskId),
      keys.taskActivity(taskId),
      keys.taskWatchers(taskId),
    );
    if (typeof assignee === "string" && assignee) {
      cleanup.zrem(keys.userAssigned(assignee), taskId);
      cleanupOps++;
    }
    if (logIds.length > 0) {
      for (const userId of memberIds) {
        cleanup.zrem(keys.userTimeLogs(userId), ...logIds);
        cleanupOps++;
      }
    }
  });
  memberIds.forEach((userId, i) => {
    const timer = parseTimer(childResults[tasks.length * 3 + i]);
    if (timer?.projectId === project.id) {
      toDelete.push(keys.activeTimer(userId));
    }
    cleanup.zrem(keys.userProjects(userId), project.id);
    cleanupOps++;
  });
  for (const moduleId of modules) {
    toDelete.push(keys.module(moduleId), keys.moduleTasks(moduleId), keys.moduleStats(moduleId));
  }
  toDelete.push(
    keys.project(project.id),
    keys.projectByKey(project.key),
    keys.projectMembers(project.id),
    keys.projectModules(project.id),
    keys.projectTasks(project.id),
    keys.projectDue(project.id),
    keys.projectStart(project.id),
    keys.projectStats(project.id),
    keys.projectTaskSeq(project.id),
    keys.projectActivity(project.id),
    keys.projectSearch(project.id),
  );

  if (cleanupOps > 0) await cleanup.exec();
  await deleteInChunks(toDelete);
}
