import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/session";
import { getMemberRole } from "@/lib/redis/members";
import { LOCAL_UPLOAD_DIR } from "@/lib/storage";
import { idSchema } from "@/schemas/common";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const notFound = () => new Response("Tidak ditemukan", { status: 404 });

/**
 * Development-only file server for the local storage driver. Avatars are
 * visible to any signed-in user; task files only to members of the project
 * in their path. Everything except images is downloaded, never rendered.
 * Returns 404 in production, where files live in Vercel Blob.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") return notFound();
  const user = await getCurrentUser();
  if (!user) return new Response("Silakan masuk", { status: 401 });

  const { path: parts } = await params;
  if (parts[0] === "attachments") {
    const projectId = parts[1] ?? "";
    if (!idSchema.safeParse(projectId).success || !(await getMemberRole(projectId, user.id))) return notFound();
  } else if (parts[0] !== "avatars") {
    return notFound();
  }
  const target = path.resolve(LOCAL_UPLOAD_DIR, ...parts);
  if (!target.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return notFound();
  try {
    const data = await readFile(target);
    const type = TYPES[path.extname(target).toLowerCase()];
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        ...(type ? {} : { "Content-Disposition": "attachment" }),
      },
    });
  } catch {
    return notFound();
  }
}
