export const NOTIFICATION_TYPES = [
  "task.assigned",
  "comment.mention",
  "comment.watched",
  "task.review",
  "task.deadline",
  "project.invited",
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
