import "server-only";
import { z } from "zod";
import { assertWritable, requireTaskAccess } from "@/lib/auth/guards";
import { addAttachment } from "@/lib/redis/attachments";
import { recordActivity } from "@/lib/redis/activities";
import { updateUser } from "@/lib/redis/users";
import { AppError, ForbiddenError } from "@/lib/errors";
import { canManageTask } from "@/lib/permissions";
import { checkUpload, sanitizeFilename, UPLOAD_KINDS, type UploadKind } from "@/lib/storage/policy";
import { isOwnedFile, readHead, removeStoredFile, storedInfo } from "@/lib/storage";
import { newId } from "@/lib/utils";
import { idSchema } from "@/schemas/common";
import type { Task } from "@/types/task";
import type { User } from "@/types/user";

export const uploadTargetSchema = z
  .object({ kind: z.enum(UPLOAD_KINDS), taskId: idSchema.optional() })
  .refine((v) => v.kind === "avatar" || Boolean(v.taskId), { message: "Tugas wajib dipilih." });

export interface UploadTarget {
  kind: UploadKind;
  /** Storage path prefix every upload of this target must start with. */
  prefix: string;
  task: Task | null;
}

/**
 * Checks that the user may upload this kind of file here, before any token
 * is issued or bytes are accepted. Avatars belong to the uploader; task files
 * need edit rights on the task in a writable project.
 */
export async function authorizeUpload(user: User, input: unknown): Promise<UploadTarget> {
  const parsed = uploadTargetSchema.safeParse(input);
  if (!parsed.success) throw new AppError("Permintaan unggah tidak valid.");
  const { kind, taskId } = parsed.data;
  if (kind === "avatar") return { kind, prefix: `avatars/${user.id}`, task: null };
  const { task, project, role } = await requireTaskAccess(user, taskId ?? "");
  assertWritable(project);
  if (!canManageTask(role, task, user.id)) throw new ForbiddenError("Anda tidak dapat menambah berkas pada tugas ini.");
  return { kind, prefix: `attachments/${project.id}/${task.id}`, task };
}

/**
 * Accepts a stored file after verifying it again on the server: it must be
 * one of our files, under the authorized prefix, within the size limit, and
 * its first bytes must match its declared type. Rejected files are deleted.
 */
export async function finalizeUpload(user: User, target: UploadTarget, url: string, pathname: string, filename: string, declaredType: string): Promise<{ url: string }> {
  const reject = async (reason: string): Promise<never> => {
    if (isOwnedFile(url)) await removeStoredFile(url).catch(() => undefined);
    throw new AppError(reason);
  };
  if (!isOwnedFile(url) || !pathname.startsWith(`${target.prefix}/`) || pathname.includes("..")) {
    return reject("Lokasi berkas tidak valid.");
  }
  const info = await storedInfo(url);
  if (!info) return reject("Berkas tidak ditemukan di penyimpanan.");
  const type = info.contentType || declaredType;
  const check = checkUpload(target.kind, type, info.size, await readHead(url));
  if (!check.ok) return reject(check.reason);

  if (target.kind === "avatar") {
    const previous = user.avatar;
    await updateUser(user.id, { avatar: url });
    if (previous && previous !== url && isOwnedFile(previous)) await removeStoredFile(previous).catch(() => undefined);
    return { url };
  }
  const task = target.task;
  if (!task) throw new AppError("Tugas tidak ditemukan.");
  const name = sanitizeFilename(filename);
  await addAttachment({
    id: newId(),
    taskId: task.id,
    url,
    filename: name,
    mimeType: type.split(";")[0]?.trim().toLowerCase() ?? "",
    size: info.size,
    isProof: target.kind === "proof",
    uploadedBy: user.id,
    createdAt: Date.now(),
  });
  await recordActivity({ type: "attachment.added", projectId: task.projectId, actorId: user.id, taskId: task.id, subject: task.title, meta: { file: name } });
  return { url };
}
