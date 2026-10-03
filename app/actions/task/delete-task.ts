"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { assertWritable, getTaskAccess } from "@/lib/domain/access";
import { deleteTask, listAttachments } from "@/lib/redis/repositories/task.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { canDeleteTask } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { revalidateApp } from "@/lib/revalidate";
import { taskRef } from "@/lib/utils";
import { taskIdSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";

export async function deleteTaskAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { taskId } = parseInput(taskIdSchema, input);
    const { task, project, role } = await getTaskAccess(taskId, user.id);
    assertWritable(project);
    if (!canDeleteTask(role, task, user.id)) throw new ForbiddenError("You can't delete this task.");

    const attachments = await listAttachments(task.id);
    const deleted = await deleteTask(task);
    if (!deleted) return undefined;

    // Best effort: remove stored files after the records are gone.
    const storage = getStorage();
    if (storage) {
      await Promise.allSettled(attachments.map((a) => storage.remove(a.url)));
    }
    await recordActivity({
      type: "task.deleted",
      projectId: project.id,
      actorId: user.id,
      subject: task.title,
      meta: { ref: taskRef(project.key, task.number) },
    });
    revalidateApp();
    return undefined;
  });
}
