import type { Module } from "@/types/module";
import type { Project, ProjectRole } from "@/types/project";

export const PROJECT_STATUS_LABEL: Record<Project["status"], string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

export const MODULE_STATUS_LABEL: Record<Module["status"], string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const ROLE_DESCRIPTION: Record<ProjectRole, string> = {
  OWNER: "Full control, including deleting the project",
  LEAD: "Manages modules, tasks and members",
  MEMBER: "Works on tasks, comments and tracks time",
  VIEWER: "Read-only access",
};

export function roleLabel(role: ProjectRole): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
