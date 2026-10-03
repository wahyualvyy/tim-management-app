export const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED"] as const;
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

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: ProjectIcon;
  status: ProjectStatus;
  ownerId: string;
  /** ISO calendar date (YYYY-MM-DD) or null. */
  startDate: string | null;
  /** ISO calendar date (YYYY-MM-DD) or null. */
  targetDate: string | null;
  archived: boolean;
  allowViewerComments: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProgressStats {
  total: number;
  done: number;
}

export interface ProjectSummary extends Project {
  stats: ProgressStats;
  memberCount: number;
  role: ProjectRole;
}

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
}
