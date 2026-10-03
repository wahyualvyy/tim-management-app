import "server-only";
import { getProjects } from "@/lib/redis/projects";
import { listProjectStructure } from "@/lib/redis/modules";
import { getUsers } from "@/lib/redis/users";
import { getRunningUsers } from "@/lib/redis/timeLogs";
import { taskRef } from "@/lib/utils";
import type { ModuleWithStats } from "@/types/module";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import { toPublicUser, type PublicUser } from "@/types/user";
import type { TaskItem } from "@/types/views";

/** The current server time. Server components render once per request. */
export function requestTime(): number {
  return Date.now();
}

/**
 * Resolve project keys, module/sub module names, assignees and running
 * timers for a list of tasks with batched reads (one pipeline per kind)
 * instead of per-task lookups.
 */
export async function toTaskItems(
  tasks: readonly Task[],
  known: { projects?: readonly Project[]; structure?: readonly ModuleWithStats[] } = {},
): Promise<TaskItem[]> {
  if (tasks.length === 0) return [];
  const projectIds = [...new Set(tasks.map((t) => t.projectId))];
  const missing = projectIds.filter((id) => !known.projects?.some((p) => p.id === id));
  const projects = [...(known.projects ?? []), ...(await getProjects(missing))];
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const needStructure = known.structure ? projectIds.filter((id) => id !== known.structure?.[0]?.projectId) : projectIds;
  const [structures, users, running] = await Promise.all([
    Promise.all(needStructure.map((id) => listProjectStructure(id))),
    getUsers(tasks.flatMap((t) => t.assigneeIds)),
    getRunningUsers(tasks.map((t) => t.id)),
  ]);
  const names = new Map<string, string>();
  for (const m of [...(known.structure ?? []), ...structures.flat()]) {
    names.set(m.id, m.name);
    for (const s of m.subModules) names.set(s.id, s.name);
  }

  return tasks.flatMap((t) => {
    const project = projectMap.get(t.projectId);
    if (!project) return [];
    const assignees: PublicUser[] = t.assigneeIds.flatMap((id) => {
      const u = users.get(id);
      return u ? [toPublicUser(u)] : [];
    });
    return [
      {
        ...t,
        ref: taskRef(project.key, t.number),
        projectName: project.name,
        moduleName: names.get(t.moduleId) ?? "Modul",
        subModuleName: t.subModuleId ? (names.get(t.subModuleId) ?? null) : null,
        assignees,
        runningUserIds: running.get(t.id) ?? [],
      },
    ];
  });
}
