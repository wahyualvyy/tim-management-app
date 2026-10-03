import "server-only";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { createNotifications, type NotificationInput } from "@/lib/redis/repositories/notification.repository";
import { listAssignedTasks } from "@/lib/redis/repositories/task.repository";
import { getProjects } from "@/lib/redis/repositories/project.repository";
import { addDays, formatCalendarDate, todayIn } from "@/lib/dates";
import { emailHandle, taskHref, taskRef } from "@/lib/utils";
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

/** Resolve "@handle" mentions (email local part) to member ids. */
export function extractMentions(body: string, members: readonly User[]): string[] {
  const handles = new Set([...body.matchAll(/(^|\s)@([a-z0-9._-]{2,64})/gi)].map((m) => (m[2] ?? "").toLowerCase()));
  if (handles.size === 0) return [];
  return members.filter((m) => handles.has(emailHandle(m.email))).map((m) => m.id);
}

/**
 * Lazily creates "deadline approaching" notifications for tasks assigned to
 * the user that are due today or tomorrow in their time zone. Throttled to
 * once an hour per user, and each task/due-date pair notifies only once.
 */
export async function scanDeadlines(user: User): Promise<void> {
  const r = redis();
  const go = await r.set(keys.userDeadlineScan(user.id), "1", { nx: true, ex: 3600 });
  if (go !== "OK") return;
  const today = todayIn(user.timezone, Date.now());
  const tomorrow = addDays(today, 1);
  const due = (await listAssignedTasks(user.id)).filter(
    (t) => t.status !== "DONE" && t.dueDate !== null && t.dueDate >= today && t.dueDate <= tomorrow,
  );
  if (due.length === 0) return;
  const projects = new Map((await getProjects([...new Set(due.map((t) => t.projectId))])).map((p) => [p.id, p]));
  const inputs: NotificationInput[] = [];
  for (const task of due) {
    const project = projects.get(task.projectId);
    if (!project || !task.dueDate) continue;
    const first = await r.set(keys.taskDeadlineNotified(task.id, user.id, task.dueDate), "1", {
      nx: true,
      ex: 60 * 60 * 24 * 3,
    });
    if (first !== "OK") continue;
    inputs.push({
      userId: user.id,
      type: "task.deadline",
      actorId: null,
      title: `${taskRef(project.key, task.number)} is due ${task.dueDate === today ? "today" : "tomorrow"}`,
      body: `${task.title} · due ${formatCalendarDate(task.dueDate)}`,
      href: taskHref(project.id, task.id),
    });
  }
  await createNotifications(inputs);
}
