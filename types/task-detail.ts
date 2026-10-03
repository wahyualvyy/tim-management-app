import type { Activity } from "./activity";
import type { Module } from "./module";
import type { ProjectRole } from "./project";
import type { Attachment, Comment, Task } from "./task";
import type { TimeLog } from "./timer";
import type { PublicUser } from "./user";

export interface TaskPermissions {
  edit: boolean;
  delete: boolean;
  comment: boolean;
  trackTime: boolean;
  assignOthers: boolean;
  manageComments: boolean;
}

/** Everything the task drawer needs, loaded in one server action call. */
export interface TaskDetail {
  task: Task;
  project: { id: string; key: string; name: string; archived: boolean };
  modules: Pick<Module, "id" | "name">[];
  members: (PublicUser & { role: ProjectRole })[];
  users: Record<string, PublicUser>;
  comments: Comment[];
  timeLogs: TimeLog[];
  activity: Activity[];
  attachments: Attachment[];
  permissions: TaskPermissions;
  viewerId: string;
  uploadsEnabled: boolean;
}
