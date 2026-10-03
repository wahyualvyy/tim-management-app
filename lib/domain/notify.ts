import "server-only";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { createNotifications, type NotificationInput } from "@/lib/redis/notifications";
import { listUserDueBetween } from "@/lib/redis/tasks";
import { getProjects } from "@/lib/redis/projects";
import { getMemberRoles } from "@/lib/redis/members";
import { findUserIdsByUsernames } from "@/lib/redis/users";
import { addDays, formatCalendarDate, todayIn } from "@/lib/dates";
import { taskHref, taskRef } from "@/lib/utils";
import type { User } from "@/types/user";

/** Send the same notification to several users, skipping the actor and duplicates. */
export async function notify(
  recipients: Iterable<string | null | undefined>,
  actorId: string,
  payload: Omit<NotificationInput, "userId" | "actorId">,
): Promise<void> {
  const unique = new Set<string>();
  for (const id of recipients) if (id && id !== actorId) unique.add(id);
  await createNotifications([...unique].map((userId) => ({ ...payload, userId, actorId })));
}

/** "@username" handles in a text, lowercased and deduplicated. */
export function parseMentionHandles(body: string): string[] {
  return [...new Set([...body.matchAll(/(^|[^\w@])@([a-z0-9][a-z0-9._-]{1,29})/gi)].map((m) => (m[2] ?? "").toLowerCase()))];
}

/** Resolve mentions to ids of project members: username index lookup, then membership check. */
export async function resolveMentions(projectId: string, body: string): Promise<string[]> {
  const ids = await findUserIdsByUsernames(parseMentionHandles(body));
  if (ids.length === 0) return [];
  const roles = await getMemberRoles(projectId, ids);
  return ids.filter((id) => roles.get(id));
}

/**
 * Lazily creates "deadline approaching" notifications for open tasks
 * assigned to the user that are due today or tomorrow in their time zone.
 * Throttled to once an hour per user; each task/due date notifies once.
 */
export async function scanDeadlines(user: User): Promise<void> {
  const r = redis();
  if ((await r.set(keys.userDeadlineScan(user.id), "1", { nx: true, ex: 3600 })) !== "OK") return;
  const today = todayIn(user.timezone, Date.now());
  const tomorrow = addDays(today, 1);
  // Reads only open tasks due today or tomorrow from the user's due index.
  const due = await listUserDueBetween(user.id, today, tomorrow, 50);
  if (due.length === 0) return;
  const projects = new Map((await getProjects([...new Set(due.map((t) => t.projectId))])).map((p) => [p.id, p]));
  const inputs: NotificationInput[] = [];
  for (const task of due) {
    const project = projects.get(task.projectId);
    if (!project || !task.dueDate) continue;
    const first = await r.set(keys.taskDeadlineNotified(task.id, user.id, task.dueDate), "1", { nx: true, ex: 259200 });
    if (first !== "OK") continue;
    inputs.push({
      userId: user.id,
      type: "task.deadline",
      actorId: null,
      title: `${taskRef(project.key, task.number)} jatuh tempo ${task.dueDate === today ? "hari ini" : "besok"}`,
      body: `${task.title} · tenggat ${formatCalendarDate(task.dueDate)}`,
      href: taskHref(project.id, task.id),
    });
  }
  await createNotifications(inputs);
}
