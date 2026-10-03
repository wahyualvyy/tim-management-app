import "server-only";
import { getMembers } from "@/lib/redis/repositories/project.repository";
import { listModules } from "@/lib/redis/repositories/module.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
import { atLeast, canEditTask, isWritable } from "@/lib/permissions";
import type { Project, ProjectRole } from "@/types/project";
import type { ModuleWithStats } from "@/types/module";
import type { Task } from "@/types/task";
import { toPublicUser, type PublicUser } from "@/types/user";
import type { CreateTaskContext } from "@/types/views";

export interface ProjectMemberView extends PublicUser {
  role: ProjectRole;
}

/** Modules and members with user records, loaded together for project pages. */
export async function loadProjectStructure(
  projectId: string,
): Promise<{ modules: ModuleWithStats[]; members: ProjectMemberView[] }> {
  const [modules, memberRoles] = await Promise.all([listModules(projectId), getMembers(projectId)]);
  const users = await getUsers(memberRoles.map((m) => m.userId));
  const order: Record<ProjectRole, number> = { OWNER: 0, LEAD: 1, MEMBER: 2, VIEWER: 3 };
  const members = memberRoles
    .flatMap((m) => {
      const u = users.get(m.userId);
      return u ? [{ ...toPublicUser(u), role: m.role }] : [];
    })
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  return { modules, members };
}

/** What the "new task" dialog may offer this viewer, or null if they can't create tasks. */
export function createTaskContext(
  project: Project,
  role: ProjectRole,
  viewerId: string,
  modules: ModuleWithStats[],
  members: ProjectMemberView[],
): CreateTaskContext | null {
  if (!isWritable(project) || !atLeast(role, "MEMBER")) return null;
  const workers = members.filter((m) => m.role !== "VIEWER");
  return {
    projectId: project.id,
    viewerId,
    modules: modules.map((m) => ({ id: m.id, name: m.name })),
    assignees: atLeast(role, "LEAD") ? workers : workers.filter((m) => m.id === viewerId),
  };
}

export function movableTaskIds(project: Project, role: ProjectRole, viewerId: string, tasks: Task[]): string[] {
  if (!isWritable(project)) return [];
  return tasks.filter((t) => canEditTask(role, t, viewerId)).map((t) => t.id);
}
