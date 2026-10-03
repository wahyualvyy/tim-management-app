export const ACTIVITY_TYPES = [
  "project.created",
  "project.updated",
  "project.archived",
  "project.restored",
  "member.added",
  "member.removed",
  "member.role_changed",
  "module.created",
  "module.updated",
  "module.deleted",
  "task.created",
  "task.updated",
  "task.status_changed",
  "task.assigned",
  "task.due_changed",
  "task.completed",
  "task.deleted",
  "task.moved",
  "comment.added",
  "timer.started",
  "timer.stopped",
  "time.logged",
  "attachment.added",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Activity {
  id: string;
  type: ActivityType;
  projectId: string;
  actorId: string;
  taskId: string | null;
  /** Short, already-resolved description of the target, e.g. task title. */
  subject: string;
  /** Extra details such as from/to values. Kept small and flat. */
  meta: Record<string, string>;
  createdAt: number;
}
