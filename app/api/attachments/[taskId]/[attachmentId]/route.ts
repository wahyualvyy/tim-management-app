import { getCurrentUser } from "@/lib/auth/session";
import { getTask } from "@/lib/redis/tasks";
import { getMemberRole } from "@/lib/redis/members";
import { getAttachment } from "@/lib/redis/attachments";
import { openStoredFile } from "@/lib/storage";
import { isInlineType } from "@/lib/storage/policy";
import { idSchema } from "@/schemas/common";

const notFound = () => new Response("Tidak ditemukan", { status: 404 });

/**
 * Permission-checked download of a task attachment. The storage URL is never
 * sent to the browser; only project members can fetch the file, and
 * non-members get the same 404 as a missing file.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string; attachmentId: string }> }) {
  const { taskId, attachmentId } = await params;
  if (!idSchema.safeParse(taskId).success || !idSchema.safeParse(attachmentId).success) return notFound();
  const user = await getCurrentUser();
  if (!user || user.status === "SUSPENDED") return new Response("Silakan masuk", { status: 401 });

  const task = await getTask(taskId);
  if (!task || !(await getMemberRole(task.projectId, user.id))) return notFound();
  const attachment = await getAttachment(task.id, attachmentId);
  if (!attachment) return notFound();
  const stream = await openStoredFile(attachment.url);
  if (!stream) return notFound();

  const inline = isInlineType(attachment.mimeType);
  const filename = encodeURIComponent(attachment.filename);
  return new Response(stream, {
    headers: {
      "Content-Type": inline || attachment.mimeType.startsWith("text/") ? attachment.mimeType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
      "Content-Length": String(attachment.size),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      // Even if a file were mis-detected, it cannot run scripts in our origin.
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
