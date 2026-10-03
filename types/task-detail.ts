import type { Activity } from "./activity";
import type { Comment, Task } from "./task";
import type { TimeLog, TimeSummary } from "./timer";
import type { PublicUser } from "./user";
import type { StructureOption } from "./views";

export interface TaskPermissions {
  edit: boolean;
  delete: boolean;
  comment: boolean;
  trackTime: boolean;
  assignOthers: boolean;
  moderate: boolean;
}

/** Attachment as sent to the browser: a permission-checked download path, never the storage URL. */
export interface AttachmentView {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isProof: boolean;
  uploadedBy: string;
  createdAt: number;
  href: string;
}

export const COMMENT_PAGE = 30;
export const TIME_LOG_PAGE = 20;

/** Everything the task drawer needs on open; older comments and logs load on demand. */
export interface TaskDetail {
  task: Task;
  ref: string;
  project: { id: string; key: string; name: string; archived: boolean };
  structure: StructureOption[];
  /** Only the people referenced in this payload (creator, assignees, authors, actors). */
  users: Record<string, PublicUser>;
  comments: Comment[];
  hasOlderComments: boolean;
  timeLogs: TimeLog[];
  hasMoreTimeLogs: boolean;
  time: TimeSummary;
  /** Users with a running timer on this task and when they started. */
  running: { userId: string; startedAt: number }[];
  activity: Activity[];
  attachments: AttachmentView[];
  permissions: TaskPermissions;
  viewerId: string;
  uploadMode: "direct" | "server" | null;
}
