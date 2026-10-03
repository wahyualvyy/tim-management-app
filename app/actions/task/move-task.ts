"use server";

import { assertWritable, requireAuth, requireTaskAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { notify } from "@/lib/domain/notify";
import { getWatchers, setTaskStatus, updateTask } from "@/lib/redis/tasks";
import { listLeadIds } from "@/lib/redis/members";
import { recordActivity } from "@/lib/redis/activities";
import { canManageTask } from "@/lib/permissions";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { taskHref, taskRef } from "@/lib/utils";
import { completeTaskSchema, moveTaskSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";
import type { TaskStatus } from "@/types/task";
import type { User } from "@/types/user";

async function transition(user: User, taskId: string, status: TaskStatus, order?: number, completionNotes?: string) {
  const { task, project, role } = await requireTaskAccess(user, taskId);
  assertWritable(project);
  if (!canManageTask(role, task, user.id)) throw new ForbiddenError("Anda tidak dapat mengubah tugas ini.");

  if (completionNotes !== undefined && completionNotes !== task.completionNotes) {
    await updateTask(task, { completionNotes }, project.key);
  }
  const previous = await setTaskStatus(task, status, order);
  if (previous === null) throw new NotFoundError("Tugas tidak ditemukan.");
  if (previous === status) return;

  const ref = taskRef(project.key, task.number);
  const href = taskHref(project.id, task.id);
  await recordActivity({
    type: status === "DONE" ? "task.completed" : "task.status_changed",
    projectId: project.id,
    actorId: user.id,
    taskId: task.id,
    subject: task.title,
    meta: { from: previous, to: status },
  });

  const watchers = await getWatchers(task.id);
  if (status === "REVIEW") {
    // Reviews go to everyone following the task plus the project's leads.
    const leads = await listLeadIds(project.id);
    await notify([...watchers, ...leads], user.id, {
      type: "task.review_requested",
      title: `${ref} menunggu tinjauan`,
      body: `${user.name} meminta tinjauan untuk "${task.title}".`,
      href,
    });
  } else if (status === "DONE") {
    await notify(watchers, user.id, {
      type: "task.completed",
      title: `${ref} selesai`,
      body: `${user.name} menyelesaikan "${task.title}".`,
      href,
    });
  } else {
    await notify([task.creatorId, ...task.assigneeIds], user.id, {
      type: "task.status_changed",
      title: `${ref}: ${TASK_STATUS_LABEL[status]}`,
      body: `${user.name} memindahkan "${task.title}" dari ${TASK_STATUS_LABEL[previous]}.`,
      href,
    });
  }
}

/** Board drag: change status and/or position. */
export async function moveTaskAction(input: unknown): Promise<ActionResult> {
  return runAction("moveTask", async () => {
    const user = await requireAuth();
    const { taskId, status, order } = parseInput(moveTaskSchema, input);
    await transition(user, taskId, status, order);
    revalidateApp();
    return undefined;
  });
}

/** Mark done with optional completion notes (proof files are uploaded separately). */
export async function completeTaskAction(input: unknown): Promise<ActionResult> {
  return runAction("completeTask", async () => {
    const user = await requireAuth();
    const { taskId, completionNotes } = parseInput(completeTaskSchema, input);
    await transition(user, taskId, "DONE", undefined, completionNotes);
    revalidateApp();
    return undefined;
  });
}
