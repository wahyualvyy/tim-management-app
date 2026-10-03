"use server";

import { assertWritable, requireAuth, requireTaskAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { deleteTask } from "@/lib/redis/tasks";
import { listAttachments } from "@/lib/redis/attachments";
import { recordActivity } from "@/lib/redis/activities";
import { canDeleteTask } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import { removeStoredFile } from "@/lib/storage";
import { revalidateApp } from "@/lib/revalidate";
import { taskRef } from "@/lib/utils";
import { taskIdSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";

export async function deleteTaskAction(input: unknown): Promise<ActionResult> {
  return runAction("deleteTask", async () => {
    const user = await requireAuth();
    const { taskId } = parseInput(taskIdSchema, input);
    const { task, project, role } = await requireTaskAccess(user, taskId);
    assertWritable(project);
    if (!canDeleteTask(role, task, user.id)) throw new ForbiddenError("Anda tidak dapat menghapus tugas ini.");

    const attachments = await listAttachments(task.id);
    if (!(await deleteTask(task, project.key))) return undefined;
    await Promise.allSettled(attachments.map((a) => removeStoredFile(a.url)));
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
