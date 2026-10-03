export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  projectId: string;
  moduleId: string;
  /** Tasks normally belong to a sub module; null means directly under the module. */
  subModuleId: string | null;
  /** Human readable number within the project, e.g. 12 in "WEB-12". */
  number: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  creatorId: string;
  /** ISO calendar date (YYYY-MM-DD) or null. */
  startDate: string | null;
  /** ISO calendar date (YYYY-MM-DD) or null. */
  dueDate: string | null;
  labels: string[];
  estimatedMinutes: number | null;
  /** Sum of finalized time logs, in seconds. Running timers are not included. */
  trackedSeconds: number;
  completionNotes: string;
  completedAt: number | null;
  /** Position within its board column; lower comes first. */
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  taskId: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  /** True when uploaded as proof of completion. */
  isProof: boolean;
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
