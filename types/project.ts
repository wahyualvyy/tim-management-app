export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_ROLES = ["OWNER", "LEAD", "MEMBER", "VIEWER"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_ICONS = [
  "folder",
  "rocket",
  "layers",
  "box",
  "code",
  "briefcase",
  "globe",
  "database",
  "smartphone",
  "palette",
  "megaphone",
  "flask",
] as const;
export type ProjectIcon = (typeof PROJECT_ICONS)[number];

export const PROJECT_COLORS = ["slate", "blue", "violet", "green", "amber", "rose", "cyan", "orange"] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: ProjectIcon;
  color: ProjectColor;
  status: ProjectStatus;
  ownerId: string;
  /** ISO calendar date (YYYY-MM-DD) or null. */
  startDate: string | null;
  /** ISO calendar date (YYYY-MM-DD) or null. */
  dueDate: string | null;
  allowViewerComments: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProgressStats {
  total: number;
  done: number;
}

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
}
