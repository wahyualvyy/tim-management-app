import type { Project, ProjectRole } from "@/types/project";
import type { Comment, Task } from "@/types/task";

/**
 * Pure permission rules. Server actions enforce these through
 * lib/domain/access.ts; the UI uses the same functions only to decide what
 * to show, never as the security boundary.
 */

const RANK: Record<ProjectRole, number> = { VIEWER: 0, MEMBER: 1, LEAD: 2, OWNER: 3 };

export function atLeast(role: ProjectRole | null, minimum: ProjectRole): boolean {
  return role !== null && RANK[role] >= RANK[minimum];
}

export function canViewProject(role: ProjectRole | null): boolean {
  return role !== null;
}

export function canEditProject(role: ProjectRole | null): boolean {
  return atLeast(role, "LEAD");
}

export function canDeleteProject(role: ProjectRole | null): boolean {
  return role === "OWNER";
}

export function canManageMembers(role: ProjectRole | null): boolean {
  return atLeast(role, "LEAD");
}

/** Roles the actor may hand out. Only the owner can create leads; nobody assigns OWNER here. */
export function assignableRoles(actor: ProjectRole | null): ProjectRole[] {
  if (actor === "OWNER") return ["LEAD", "MEMBER", "VIEWER"];
  if (actor === "LEAD") return ["MEMBER", "VIEWER"];
  return [];
}

/** Whether the actor may change or remove a member who currently has `target` role. */
export function canManageMember(actor: ProjectRole | null, target: ProjectRole): boolean {
  if (target === "OWNER") return false;
  if (actor === "OWNER") return true;
  if (actor === "LEAD") return target === "MEMBER" || target === "VIEWER";
  return false;
}

export function canManageModules(role: ProjectRole | null): boolean {
  return atLeast(role, "LEAD");
}

export function canCreateTask(role: ProjectRole | null): boolean {
  return atLeast(role, "MEMBER");
}

/** Leads edit anything; members edit tasks they created, are assigned to, or that are unassigned. */
export function canEditTask(role: ProjectRole | null, task: Pick<Task, "creatorId" | "assigneeId">, userId: string): boolean {
  if (atLeast(role, "LEAD")) return true;
  if (role !== "MEMBER") return false;
  return task.creatorId === userId || task.assigneeId === userId || task.assigneeId === null;
}

/** Members may only assign a task to themselves or leave it unassigned. */
export function canAssignTo(role: ProjectRole | null, userId: string, assigneeId: string | null): boolean {
  if (atLeast(role, "LEAD")) return true;
  return role === "MEMBER" && (assigneeId === null || assigneeId === userId);
}

export function canDeleteTask(role: ProjectRole | null, task: Pick<Task, "creatorId">, userId: string): boolean {
  if (atLeast(role, "LEAD")) return true;
  return role === "MEMBER" && task.creatorId === userId;
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

/** Archived projects are read-only for everyone until restored. */
export function isWritable(project: Pick<Project, "archived">): boolean {
  return !project.archived;
}
