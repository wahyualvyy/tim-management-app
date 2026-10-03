import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth/session";
import { authorizeUpload } from "@/lib/domain/uploads";
import { enforceRateLimit } from "@/lib/rate-limit";
import { uploadPolicy } from "@/lib/storage/policy";
import { storageDriver } from "@/lib/storage";
import { AppError } from "@/lib/errors";
import { logError } from "@/lib/log";

/**
 * Issues short-lived Vercel Blob client tokens. The browser then uploads the
 * file directly to Blob (no 4.5 MB serverless body limit) and registers it
 * with registerUploadAction, which re-validates the stored bytes.
 */
export async function POST(request: Request) {
  if (storageDriver() !== "vercel-blob") return NextResponse.json({ error: "Unggahan tidak tersedia." }, { status: 404 });
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (!user || user.status === "SUSPENDED") throw new AppError("Silakan masuk terlebih dahulu.");
        await enforceRateLimit("upload", user.id);
        let payload: unknown = null;
        try {
          payload = clientPayload ? JSON.parse(clientPayload) : null;
        } catch {
          payload = null;
        }
        const target = await authorizeUpload(user, payload);
        // The client chooses the file name, but only inside the authorized folder.
        if (!pathname.startsWith(`${target.prefix}/`) || pathname.includes("..") || !/^[\w./-]+$/.test(pathname)) {
          throw new AppError("Lokasi berkas tidak valid.");
        }
        const policy = uploadPolicy(target.kind);
        return {
          allowedContentTypes: policy.types,
          maximumSizeInBytes: policy.maxBytes,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: 403 });
    logError("api.uploads", error);
    return NextResponse.json({ error: "Gagal menyiapkan unggahan." }, { status: 500 });
  }
}
