import type { Task } from "./task";
import type { PublicUser } from "./user";

/** What the "new task" dialog may offer the viewer. */
export interface CreateTaskContext {
  projectId: string;
  modules: { id: string; name: string }[];
  assignees: { id: string; name: string }[];
  viewerId: string;
}

/** A task prepared for lists and boards: references resolved on the server. */
export interface TaskItem extends Task {
  ref: string;
  moduleName: string;
  projectName: string;
  assignee: PublicUser | null;
}
