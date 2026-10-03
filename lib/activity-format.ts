import type { Activity } from "@/types/activity";

/** Human sentence for an activity entry, without the actor's name. */
export function describeActivity(a: Activity): string {
  const m = a.meta;
  switch (a.type) {
    case "project.created":
      return "created the project";
    case "project.updated":
      return "updated project settings";
    case "project.archived":
      return "archived the project";
    case "project.restored":
      return "restored the project";
    case "member.added":
      return `added ${a.subject} as ${(m.role ?? "member").toLowerCase()}`;
    case "member.removed":
      return `removed ${a.subject}`;
    case "member.role_changed":
      return `changed ${a.subject}'s role from ${(m.from ?? "").toLowerCase()} to ${(m.to ?? "").toLowerCase()}`;
    case "module.created":
      return `created module ${a.subject}`;
    case "module.updated":
      return `updated module ${a.subject}`;
    case "module.deleted":
      return `deleted module ${a.subject}`;
    case "task.created":
      return `created ${m.ref ? `${m.ref} ` : ""}${a.subject}`;
    case "task.updated":
      return `edited ${a.subject}`;
    case "task.status_changed":
      return `moved ${a.subject} from ${m.from} to ${m.to}`;
    case "task.assigned":
      return m.to === "Unassigned" ? `unassigned ${a.subject}` : `assigned ${a.subject} to ${m.to}`;
    case "task.due_changed":
      return m.to === "none" ? `cleared the due date of ${a.subject}` : `set ${a.subject} due ${m.to}`;
    case "task.completed":
      return `completed ${a.subject}`;
    case "task.deleted":
      return `deleted ${m.ref ? `${m.ref} ` : ""}${a.subject}`;
    case "task.moved":
      return `moved ${a.subject} to ${m.to}`;
    case "comment.added":
      return `commented on ${a.subject}`;
    case "timer.started":
      return `started a timer on ${a.subject}`;
    case "timer.stopped":
      return `tracked ${m.duration ?? "time"} on ${a.subject}`;
    case "time.logged":
      return `logged ${m.duration ?? "time"} on ${a.subject}`;
    case "attachment.added":
      return `attached ${m.file ?? "a file"} to ${a.subject}`;
  }
}
