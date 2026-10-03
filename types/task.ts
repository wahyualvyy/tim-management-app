export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  projectId: string;
  moduleId: string;
  /** Human readable reference, e.g. "WEB-12". */
  number: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  creatorId: string;
  /** ISO calendar date (YYYY-MM-DD) or null. */
  startDate: string | null;
  /** ISO calendar date (YYYY-MM-DD) or null. */
  dueDate: string | null;
  labels: string[];
  estimateMinutes: number | null;
  trackedSeconds: number;
  completionNotes: string;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  taskId: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
  uploadedBy: string;
  createdAt: number;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  edited: boolean;
}
