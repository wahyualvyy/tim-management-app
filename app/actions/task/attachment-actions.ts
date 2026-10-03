"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { assertWritable, getTaskAccess } from "@/lib/domain/access";
import { addAttachment, getAttachment, removeAttachment } from "@/lib/redis/repositories/task.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { atLeast, canEditTask } from "@/lib/permissions";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ATTACHMENT_MAX_BYTES, getStorage } from "@/lib/storage";
import { revalidateApp } from "@/lib/revalidate";
import { newId } from "@/lib/utils";
import { attachmentIdSchema, taskIdSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";

export async function uploadAttachmentAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { taskId } = parseInput(taskIdSchema, { taskId: formData.get("taskId") });
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("Choose a file to upload.");
    if (file.size > ATTACHMENT_MAX_BYTES) throw new AppError("Files must be 8 MB or smaller.");

    const { task, project, role } = await getTaskAccess(taskId, user.id);
    assertWritable(project);
    if (!canEditTask(role, task, user.id)) throw new ForbiddenError();
    const storage = getStorage();
    if (!storage) throw new AppError("File uploads are not configured on this server.");

    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-100) || "file";
    const { url } = await storage.upload(`attachments/${project.id}/${task.id}/${safeName}`, file);
    await addAttachment({
      id: newId(),
      taskId: task.id,
      name: file.name.slice(0, 200),
      url,
      size: file.size,
      contentType: file.type,
      uploadedBy: user.id,
      createdAt: Date.now(),
    });
    await recordActivity({
      type: "attachment.added",
      projectId: project.id,
      actorId: user.id,
      taskId: task.id,
      subject: task.title,
      meta: { file: file.name.slice(0, 100) },
    });
    revalidateApp();
    return undefined;
  });
}

export async function removeAttachmentAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { taskId, attachmentId } = parseInput(attachmentIdSchema, input);
    const { task, project, role } = await getTaskAccess(taskId, user.id);
    assertWritable(project);
    const attachment = await getAttachment(task.id, attachmentId);
    if (!attachment) throw new NotFoundError("Attachment not found.");
    if (attachment.uploadedBy !== user.id && !atLeast(role, "LEAD")) throw new ForbiddenError();
    await removeAttachment(task.id, attachmentId);
    await getStorage()?.remove(attachment.url).catch(() => undefined);
    revalidateApp();
    return undefined;
  });
}
