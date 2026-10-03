import type { Project, ProjectRole } from "@/types/project";
import type { Comment, Task } from "@/types/task";
import type { User } from "@/types/user";

/**
 * Pure permission rules. Server actions enforce them through lib/auth/guards;
 * the UI uses the same functions only to decide what to show.
 *
 * OWNER  full control, including deleting the project and changing roles
 * LEAD   manages modules, sub modules, tasks, and members/viewers
 * MEMBER creates tasks and works on tasks they created, are assigned to, or that are unassigned
 * VIEWER read only (may comment when the project allows it)
 */

const RANK: Record<ProjectRole, number> = { VIEWER: 0, MEMBER: 1, LEAD: 2, OWNER: 3 };

export function atLeast(role: ProjectRole | null, minimum: ProjectRole): boolean {
  return role !== null && RANK[role] >= RANK[minimum];
}

export function isAdmin(user: Pick<User, "role">): boolean {
  return user.role === "ADMIN";
}

export function isSuspended(user: Pick<User, "status">): boolean {
  return user.status === "SUSPENDED";
}

/** Archived projects are read-only for everyone until reactivated. */
export function isWritable(project: Pick<Project, "status">): boolean {
  return project.status !== "ARCHIVED";
}

export function canEditProject(role: ProjectRole | null): boolean {
  return role === "OWNER";
}

export function canDeleteProject(role: ProjectRole | null): boolean {
  return role === "OWNER";
}

export function canManageMembers(role: ProjectRole | null): boolean {
  return atLeast(role, "LEAD");
}

/** Roles the actor may grant. Nobody grants OWNER; only the owner creates leads. */
export function assignableRoles(actor: ProjectRole | null): ProjectRole[] {
  if (actor === "OWNER") return ["LEAD", "MEMBER", "VIEWER"];
  if (actor === "LEAD") return ["MEMBER", "VIEWER"];
  return [];
}

/** Whether the actor may change or remove a member who currently has `target`. */
export function canManageMember(actor: ProjectRole | null, target: ProjectRole): boolean {
  if (target === "OWNER") return false;
  if (actor === "OWNER") return true;
  if (actor === "LEAD") return target === "MEMBER" || target === "VIEWER";
  return false;
}

export function canManageStructure(role: ProjectRole | null): boolean {
  return atLeast(role, "LEAD");
}

export function canCreateTask(role: ProjectRole | null): boolean {
  return atLeast(role, "MEMBER");
}

export function canManageTask(
  role: ProjectRole | null,
  task: Pick<Task, "creatorId" | "assigneeIds">,
  userId: string,
): boolean {
  if (atLeast(role, "LEAD")) return true;
  if (role !== "MEMBER") return false;
  return task.creatorId === userId || task.assigneeIds.includes(userId) || task.assigneeIds.length === 0;
}

export function canDeleteTask(role: ProjectRole | null, task: Pick<Task, "creatorId">, userId: string): boolean {
  if (atLeast(role, "LEAD")) return true;
  return role === "MEMBER" && task.creatorId === userId;
}

/** Leads assign anyone; members may only add or remove themselves. */
export function canChangeAssignees(
  role: ProjectRole | null,
  userId: string,
  before: readonly string[],
  after: readonly string[],
): boolean {
  if (atLeast(role, "LEAD")) return true;
  if (role !== "MEMBER") return false;
  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  return [...added, ...removed].every((id) => id === userId);
}

export function canComment(role: ProjectRole | null, project: Pick<Project, "allowViewerComments">): boolean {
  if (atLeast(role, "MEMBER")) return true;
  return role === "VIEWER" && project.allowViewerComments;
}

export function canEditComment(comment: Pick<Comment, "authorId">, userId: string): boolean {
  return comment.authorId === userId;
}

export function canDeleteComment(role: ProjectRole | null, comment: Pick<Comment, "authorId">, userId: string): boolean {
  return comment.authorId === userId || atLeast(role, "LEAD");
}

export function canTrackTime(role: ProjectRole | null): boolean {
  return atLeast(role, "MEMBER");
}
