import type { Task } from "./task";
import type { PublicUser } from "./user";

/** A task prepared for lists and boards: references resolved on the server. */
export interface TaskItem extends Task {
  ref: string;
  projectName: string;
  moduleName: string;
  subModuleName: string | null;
  assignees: PublicUser[];
  /** Users with a timer running on this task right now. */
  runningUserIds: string[];
}

export interface StructureOption {
  id: string;
  name: string;
  subModules: { id: string; name: string }[];
}

/** What the "new task" dialog may offer the viewer. Assignees are searched on demand. */
export interface CreateTaskContext {
  projectId: string;
  structure: StructureOption[];
  viewerId: string;
  viewerName: string;
  viewerAvatar: string | null;
  canAssignOthers: boolean;
}

/** A person shown in pickers. */
export interface PersonOption {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  jobTitle: string;
}
