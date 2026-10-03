export const NOTIFICATION_TYPES = [
  "project.invited",
  "task.assigned",
  "task.status_changed",
  "task.review_requested",
  "task.completed",
  "task.deadline",
  "comment.mention",
  "comment.added",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string | null;
  title: string;
  body: string;
  /** In-app path to the related resource. Always a relative path. */
  href: string;
  read: boolean;
  createdAt: number;
}
