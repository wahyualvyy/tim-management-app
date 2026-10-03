import "server-only";
import { getProjects } from "@/lib/redis/repositories/project.repository";
import { listModules } from "@/lib/redis/repositories/module.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
import { taskRef } from "@/lib/utils";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import { toPublicUser } from "@/types/user";
import type { TaskItem } from "@/types/views";

/** The current server time. Server components render once per request, so this is stable per render. */
export function requestTime(): number {
  return Date.now();
}

/**
 * Resolve project keys, module names and assignees for a list of tasks with
 * batched reads (one pipeline per kind) instead of per-task lookups.
 */
export async function toTaskItems(tasks: readonly Task[], knownProjects?: readonly Project[]): Promise<TaskItem[]> {
  if (tasks.length === 0) return [];
  const projectIds = [...new Set(tasks.map((t) => t.projectId))];
  const missing = projectIds.filter((id) => !knownProjects?.some((p) => p.id === id));
  const projects = [...(knownProjects ?? []), ...(await getProjects(missing))];
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const [moduleLists, users] = await Promise.all([
    Promise.all(projectIds.map((id) => listModules(id))),
    getUsers(tasks.map((t) => t.assigneeId).filter((id): id is string => Boolean(id))),
  ]);
  const moduleNames = new Map(moduleLists.flat().map((m) => [m.id, m.name]));

  return tasks.flatMap((t) => {
    const project = projectMap.get(t.projectId);
    if (!project) return [];
    const assignee = t.assigneeId ? users.get(t.assigneeId) : undefined;
    return [
      {
        ...t,
        ref: taskRef(project.key, t.number),
        moduleName: moduleNames.get(t.moduleId) ?? "Module",
        projectName: project.name,
        assignee: assignee ? toPublicUser(assignee) : null,
      },
    ];
  });
}
