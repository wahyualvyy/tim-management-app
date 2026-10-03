"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { assertWritable, getTaskAccess } from "@/lib/domain/access";
import { notify } from "@/lib/domain/notify";
import { getWatchers, setTaskStatus, updateTask } from "@/lib/redis/repositories/task.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { canEditTask } from "@/lib/permissions";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { taskHref, taskRef } from "@/lib/utils";
import { completeTaskSchema, setTaskStatusSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";
import type { TaskStatus } from "@/types/task";

const STATUS_LABEL: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "In review",
  DONE: "Done",
};

async function transition(taskId: string, status: TaskStatus, completionNotes?: string): Promise<void> {
  const user = await requireActionUser();
  const { task, project, role } = await getTaskAccess(taskId, user.id);
  assertWritable(project);
  if (!canEditTask(role, task, user.id)) throw new ForbiddenError("You can't change this task.");

  if (completionNotes !== undefined && completionNotes !== task.completionNotes) {
    await updateTask(task, { completionNotes }, project.key);
  }
  const previous = await setTaskStatus(task, status);
  if (previous === null) throw new NotFoundError("Task not found.");
  if (previous === status) return;

  const ref = taskRef(project.key, task.number);
  await recordActivity({
    type: status === "DONE" ? "task.completed" : "task.status_changed",
    projectId: project.id,
    actorId: user.id,
    taskId: task.id,
    subject: task.title,
    meta: { from: STATUS_LABEL[previous], to: STATUS_LABEL[status] },
  });
  if (status === "REVIEW") {
    await notify(await getWatchers(task.id), user.id, {
      type: "task.review",
      title: `${ref} is ready for review`,
      body: `${user.name} moved "${task.title}" to review.`,
      href: taskHref(project.id, task.id),
    });
  }
  revalidateApp();
}

export async function setTaskStatusAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const { taskId, status } = parseInput(setTaskStatusSchema, input);
    await transition(taskId, status);
    return undefined;
  });
}

/** Mark done with optional completion notes, from the task drawer. */
export async function completeTaskAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const { taskId, completionNotes } = parseInput(completeTaskSchema, input);
    await transition(taskId, "DONE", completionNotes);
    return undefined;
  });
}
