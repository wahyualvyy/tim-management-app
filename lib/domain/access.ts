import "server-only";
import { getMemberRole, getProject } from "@/lib/redis/repositories/project.repository";
import { getTask } from "@/lib/redis/repositories/task.repository";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isWritable } from "@/lib/permissions";
import type { Project, ProjectRole } from "@/types/project";
import type { Task } from "@/types/task";

export interface ProjectAccess {
  project: Project;
  role: ProjectRole;
}

/**
 * Loads a project the user belongs to. Non-members get "not found" rather
 * than "forbidden", so project ids cannot be probed.
 */
export async function getProjectAccess(projectId: string, userId: string): Promise<ProjectAccess> {
  const [project, role] = await Promise.all([getProject(projectId), getMemberRole(projectId, userId)]);
  if (!project || !role) throw new NotFoundError("Project not found.");
  return { project, role };
}

/** Like getProjectAccess, but also requires a permission and a writable (non-archived) project. */
export async function requireProjectWrite(
  projectId: string,
  userId: string,
  allowed: (role: ProjectRole) => boolean,
): Promise<ProjectAccess> {
  const access = await getProjectAccess(projectId, userId);
  if (!allowed(access.role)) throw new ForbiddenError();
  if (!isWritable(access.project)) throw new ForbiddenError("This project is archived. Restore it to make changes.");
  return access;
}

export interface TaskAccess extends ProjectAccess {
  task: Task;
}

export async function getTaskAccess(taskId: string, userId: string): Promise<TaskAccess> {
  const task = await getTask(taskId);
  if (!task) throw new NotFoundError("Task not found.");
  const access = await getProjectAccess(task.projectId, userId);
  return { ...access, task };
}

export function assertWritable(project: Project): void {
  if (!isWritable(project)) throw new ForbiddenError("This project is archived. Restore it to make changes.");
}
