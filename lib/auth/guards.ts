import "server-only";
import { requireActionUser } from "./session";
import { getProject } from "@/lib/redis/projects";
import { getMemberRole } from "@/lib/redis/members";
import { getTask } from "@/lib/redis/tasks";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { atLeast, isAdmin, isWritable } from "@/lib/permissions";
import type { Project, ProjectRole } from "@/types/project";
import type { Task } from "@/types/task";
import type { User } from "@/types/user";

/**
 * Authorization for server actions. Every action starts with requireAuth()
 * and then one of the project/task guards; ids from the client are only
 * used to look records up, never trusted for identity or role.
 */

export async function requireAuth(): Promise<User> {
  return requireActionUser();
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (!isAdmin(user)) throw new ForbiddenError("Hanya admin yang dapat melakukan ini.");
  return user;
}

export interface ProjectAccess {
  user: User;
  project: Project;
  role: ProjectRole;
}

/**
 * Loads a project the user belongs to. Non-members get "not found" rather
 * than "forbidden", so project ids can't be probed by changing a URL.
 */
export async function requireProjectAccess(user: User, projectId: string): Promise<ProjectAccess> {
  const [project, role] = await Promise.all([getProject(projectId), getMemberRole(projectId, user.id)]);
  if (!project || !role) throw new NotFoundError("Proyek tidak ditemukan.");
  return { user, project, role };
}

export function assertWritable(project: Project): void {
  if (!isWritable(project)) {
    throw new ForbiddenError("Proyek ini diarsipkan. Aktifkan kembali untuk melakukan perubahan.");
  }
}

/** Requires a minimum role (or a custom rule) on a writable project. */
export async function requireProjectRole(
  user: User,
  projectId: string,
  rule: ProjectRole | ((role: ProjectRole) => boolean),
): Promise<ProjectAccess> {
  const access = await requireProjectAccess(user, projectId);
  const allowed = typeof rule === "function" ? rule(access.role) : atLeast(access.role, rule);
  if (!allowed) throw new ForbiddenError();
  assertWritable(access.project);
  return access;
}

export interface TaskAccess extends ProjectAccess {
  task: Task;
}

export async function requireTaskAccess(user: User, taskId: string): Promise<TaskAccess> {
  const task = await getTask(taskId);
  if (!task) throw new NotFoundError("Tugas tidak ditemukan.");
  return { ...(await requireProjectAccess(user, task.projectId)), task };
}
