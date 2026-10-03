"use server";

import { z } from "zod";
import { assertWritable, requireAuth, requireTaskAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { authorizeUpload, finalizeUpload } from "@/lib/domain/uploads";
import { getAttachment, removeAttachment } from "@/lib/redis/attachments";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkUpload, sanitizeFilename } from "@/lib/storage/policy";
import { LOCAL_URL_PREFIX, removeStoredFile, saveLocal, storageDriver } from "@/lib/storage";
import { atLeast } from "@/lib/permissions";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logError } from "@/lib/log";
import { revalidateApp } from "@/lib/revalidate";
import { attachmentIdSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";

const registerSchema = z.object({
  target: z.unknown(),
  url: z.string().url().max(2000),
  pathname: z.string().max(500),
  filename: z.string().max(300),
  contentType: z.string().max(200),
});

/** After a direct-to-Blob upload: verify the stored file and save its metadata. */
export async function registerUploadAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  return runAction("registerUpload", async () => {
    const user = await requireAuth();
    const { target, url, pathname, filename, contentType } = parseInput(registerSchema, input);
    const authorized = await authorizeUpload(user, target);
    const result = await finalizeUpload(user, authorized, url, pathname, filename, contentType);
    revalidateApp();
    return result;
  });
}

/**
 * Local development driver: the file is sent to this action, checked
 * (size, declared type and actual bytes) before anything is written.
 */
export async function uploadFileAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  return runAction("uploadFile", async () => {
    const user = await requireAuth();
    if (storageDriver() !== "local") throw new AppError("Gunakan unggahan langsung ke penyimpanan.");
    await enforceRateLimit("upload", user.id);
    const target = await authorizeUpload(user, { kind: formData.get("kind"), taskId: formData.get("taskId") || undefined });
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("Pilih berkas untuk diunggah.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkUpload(target.kind, file.type, file.size, bytes.slice(0, 512));
    if (!check.ok) throw new AppError(check.reason);
    const filename = sanitizeFilename(file.name);
    const url = await saveLocal(target.prefix, filename, bytes);
    const result = await finalizeUpload(user, target, url, url.slice(LOCAL_URL_PREFIX.length), file.name, file.type);
    revalidateApp();
    return result;
  });
}

export async function removeAttachmentAction(input: unknown): Promise<ActionResult> {
  return runAction("removeAttachment", async () => {
    const user = await requireAuth();
    const { taskId, attachmentId } = parseInput(attachmentIdSchema, input);
    const { task, project, role } = await requireTaskAccess(user, taskId);
    assertWritable(project);
    const attachment = await getAttachment(task.id, attachmentId);
    if (!attachment) throw new NotFoundError("Lampiran tidak ditemukan.");
    if (attachment.uploadedBy !== user.id && !atLeast(role, "LEAD")) throw new ForbiddenError();
    await removeAttachment(task.id, attachmentId);
    await removeStoredFile(attachment.url).catch((error: unknown) => logError("storage.remove", error));
    revalidateApp();
    return undefined;
  });
}
