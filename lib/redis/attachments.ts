import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import type { Attachment } from "@/types/task";

/** Attachment metadata only; the bytes live in external object storage. */
function parseAttachment(raw: unknown): Attachment | null {
  if (typeof raw !== "string") return null;
  try {
    const v = JSON.parse(raw) as Partial<Attachment>;
    if (typeof v.id !== "string" || typeof v.url !== "string" || typeof v.filename !== "string") return null;
    return {
      id: v.id,
      taskId: typeof v.taskId === "string" ? v.taskId : "",
      url: v.url,
      filename: v.filename,
      mimeType: typeof v.mimeType === "string" ? v.mimeType : "",
      size: typeof v.size === "number" ? v.size : 0,
      isProof: v.isProof === true,
      uploadedBy: typeof v.uploadedBy === "string" ? v.uploadedBy : "",
      createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
    };
  } catch {
    return null;
  }
}

export async function listAttachments(taskId: string): Promise<Attachment[]> {
  const raw: unknown[] = await redis().hvals(keys.taskAttachments(taskId));
  return raw
    .map(parseAttachment)
    .filter((a): a is Attachment => a !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function addAttachment(attachment: Attachment): Promise<void> {
  await redis().hset(keys.taskAttachments(attachment.taskId), { [attachment.id]: JSON.stringify(attachment) });
}

export async function getAttachment(taskId: string, attachmentId: string): Promise<Attachment | null> {
  return parseAttachment(await redis().hget(keys.taskAttachments(taskId), attachmentId));
}

export async function removeAttachment(taskId: string, attachmentId: string): Promise<void> {
  await redis().hdel(keys.taskAttachments(taskId), attachmentId);
}

/** File URLs of every attachment on the given tasks, so stored files can be cleaned up. */
export async function listAttachmentUrls(taskIds: readonly string[]): Promise<string[]> {
  if (taskIds.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of taskIds) pipe.hvals(keys.taskAttachments(id));
  const results = (await pipe.exec()) as unknown[];
  return results.flatMap((list) =>
    Array.isArray(list) ? list.map(parseAttachment).flatMap((a) => (a ? [a.url] : [])) : [],
  );
}
