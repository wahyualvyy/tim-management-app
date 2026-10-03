import "server-only";
import { del, put } from "@vercel/blob";

/**
 * File storage is pluggable. Redis only ever stores the resulting URL and
 * metadata, never file bytes. Vercel Blob is used when BLOB_READ_WRITE_TOKEN
 * is set; otherwise uploads are reported as unavailable.
 */
export interface StorageAdapter {
  upload(path: string, file: File): Promise<{ url: string }>;
  remove(url: string): Promise<void>;
}

const vercelBlobAdapter: StorageAdapter = {
  async upload(path, file) {
    const result = await put(path, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || undefined,
    });
    return { url: result.url };
  },
  async remove(url) {
    await del(url);
  },
};

export function getStorage(): StorageAdapter | null {
  return process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobAdapter : null;
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
