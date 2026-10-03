"use client";

import { upload } from "@vercel/blob/client";
import { registerUploadAction, uploadFileAction } from "@/app/actions/upload/upload-actions";
import type { ActionResult } from "@/types/action";

export type UploadMode = "direct" | "server";

export interface UploadTargetInput {
  kind: "avatar" | "proof" | "attachment";
  taskId?: string;
}

/** Limits shown to users; the server enforces the configured values. */
export const UPLOAD_HINT: Record<UploadTargetInput["kind"], string> = {
  avatar: "PNG, JPG, GIF atau WEBP.",
  proof: "Gambar, PDF, teks, ZIP atau dokumen Office.",
  attachment: "Gambar, PDF, teks, ZIP atau dokumen Office.",
};

function safeName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-100);
  return cleaned || "berkas";
}

/**
 * Uploads a file for a target. In production the browser sends the bytes
 * straight to Vercel Blob with a short-lived token, then the server verifies
 * the stored file; locally the file goes through a server action.
 */
export async function uploadFile(
  mode: UploadMode,
  target: UploadTargetInput,
  file: File,
  /** Storage folder the server authorizes: avatars/{userId} or attachments/{projectId}/{taskId}. */
  folder: string,
): Promise<ActionResult<{ url: string }>> {
  if (mode === "server") {
    const fd = new FormData();
    fd.set("kind", target.kind);
    if (target.taskId) fd.set("taskId", target.taskId);
    fd.set("file", file);
    return uploadFileAction(fd);
  }
  try {
    // The server rejects any path outside the folder it authorizes for this target.
    const blob = await upload(`${folder}/${safeName(file.name)}`, file, {
      access: "public",
      handleUploadUrl: "/api/uploads",
      clientPayload: JSON.stringify(target),
      contentType: file.type || undefined,
    });
    return registerUploadAction({ target, url: blob.url, pathname: blob.pathname, filename: file.name, contentType: file.type });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "";
    return { ok: false, error: /token|forbidden|403|masuk|lokasi/i.test(message) ? "Unggahan ditolak." : "Gagal mengunggah berkas. Coba lagi." };
  }
}
