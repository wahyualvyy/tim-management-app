import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProject } from "@/lib/redis/projects";
import { getMemberRole, memberPreview, type MemberView } from "@/lib/redis/members";
import { listProjectStructure } from "@/lib/redis/modules";
import { atLeast, canManageTask, isWritable } from "@/lib/permissions";
import type { ModuleWithStats } from "@/types/module";
import type { Project, ProjectRole } from "@/types/project";
import type { Task } from "@/types/task";
import type { User } from "@/types/user";
import type { CreateTaskContext, StructureOption } from "@/types/views";

/**
 * Loads the project for a project page and checks membership. Cached per
 * request so the layout and the page share one lookup. Non-members get a 404
 * that does not reveal whether the project exists.
 */
export const loadProjectPage = cache(async (projectId: string): Promise<{ user: User; project: Project; role: ProjectRole }> => {
  const user = await requireUser();
  const [project, role] = await Promise.all([getProject(projectId), getMemberRole(projectId, user.id)]);
  if (!project || !role) notFound();
  return { user, project, role };
});

/** First members and the total, for avatar stacks. Cached per request. */
export const loadMemberPreview = cache((projectId: string): Promise<{ members: MemberView[]; total: number }> => memberPreview(projectId, 8));

/** The module → sub module tree with stats. Cached per request. */
export const loadStructure = cache((projectId: string): Promise<ModuleWithStats[]> => listProjectStructure(projectId));

export function structureOptions(structure: readonly ModuleWithStats[]): StructureOption[] {
  return structure.map((m) => ({ id: m.id, name: m.name, subModules: m.subModules.map((s) => ({ id: s.id, name: s.name })) }));
}

/**
 * What the "new task" dialog may offer this viewer, or null if they can't
 * create tasks. Assignees are searched on demand, never listed in full.
 */
export function createTaskContext(project: Project, role: ProjectRole, viewer: User, structure: readonly ModuleWithStats[]): CreateTaskContext | null {
  if (!isWritable(project) || !atLeast(role, "MEMBER") || structure.length === 0) return null;
  return {
    projectId: project.id,
    viewerId: viewer.id,
    viewerName: viewer.name,
    viewerAvatar: viewer.avatar,
    canAssignOthers: atLeast(role, "LEAD"),
    structure: structureOptions(structure),
  };
}

export function movableTaskIds(project: Project, role: ProjectRole, viewerId: string, tasks: readonly Task[]): string[] {
  if (!isWritable(project)) return [];
  return tasks.filter((t) => canManageTask(role, t, viewerId)).map((t) => t.id);
}
