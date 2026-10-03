import "server-only";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, head } from "@vercel/blob";
import { newId } from "@/lib/utils";

/**
 * File storage. Redis only stores URLs and metadata, never file bytes.
 *
 * Drivers (STORAGE_DRIVER, or automatic):
 * - "vercel-blob": production. Files go from the browser straight to Vercel
 *   Blob with a short-lived token issued by /api/uploads after an auth and
 *   permission check, so large files never pass through a serverless function.
 * - "local": development only. Files are sent to a server action and stored
 *   in .data/uploads. Never used in production (Vercel's disk is ephemeral).
 * - none: uploads are disabled and the UI says so.
 */
export type StorageDriver = "vercel-blob" | "local";

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
export const LOCAL_URL_PREFIX = "/api/files/";
const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export function storageDriver(): StorageDriver | null {
  const configured = process.env.STORAGE_DRIVER;
  const production = process.env.NODE_ENV === "production";
  if (configured === "vercel-blob") return process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : null;
  if (configured === "local") return production ? null : "local";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  return production ? null : "local";
}

export function isStorageConfigured(): boolean {
  return storageDriver() !== null;
}

/** How the browser should upload: direct to Blob, through a server action, or not at all. */
export function uploadMode(): "direct" | "server" | null {
  const driver = storageDriver();
  return driver === "vercel-blob" ? "direct" : driver === "local" ? "server" : null;
}

export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Whether a URL points to a file this app stored (and may therefore delete). */
export function isOwnedFile(url: string): boolean {
  return url.startsWith(LOCAL_URL_PREFIX) || isBlobUrl(url);
}

/** Blob pathname ("attachments/p/t/file-abc.pdf") of a Blob URL. */
export function blobPathname(url: string): string | null {
  return isBlobUrl(url) ? decodeURIComponent(new URL(url).pathname.replace(/^\//, "")) : null;
}

/** Stores bytes with the local driver and returns the app-relative URL. */
export async function saveLocal(prefix: string, filename: string, bytes: Uint8Array): Promise<string> {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, "_").replace(/\.\.+/g, "_");
  const relative = `${safePrefix}/${newId()}-${filename}`;
  const target = path.join(LOCAL_UPLOAD_DIR, relative);
  if (!target.startsWith(LOCAL_UPLOAD_DIR + path.sep)) throw new Error("Invalid upload path");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return `${LOCAL_URL_PREFIX}${relative}`;
}

/** Absolute path of a local file URL, or null when it escapes the upload folder. */
export function localPath(url: string): string | null {
  if (!url.startsWith(LOCAL_URL_PREFIX)) return null;
  const target = path.resolve(LOCAL_UPLOAD_DIR, decodeURIComponent(url.slice(LOCAL_URL_PREFIX.length)));
  return target.startsWith(LOCAL_UPLOAD_DIR + path.sep) ? target : null;
}

/** First bytes of a stored file, used to verify its real type. */
export async function readHead(url: string, bytes = 512): Promise<Uint8Array> {
  const local = localPath(url);
  if (local) {
    const handle = await open(local, "r");
    try {
      const buffer = new Uint8Array(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return buffer.slice(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
  const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` }, cache: "no-store" });
  return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
}

/** Size and content type as recorded by the storage, not as claimed by the client. */
export async function storedInfo(url: string): Promise<{ size: number; contentType: string } | null> {
  const local = localPath(url);
  if (local) {
    try {
      const data = await readFile(local);
      return { size: data.byteLength, contentType: "" };
    } catch {
      return null;
    }
  }
  if (!isBlobUrl(url)) return null;
  try {
    const info = await head(url);
    return { size: info.size, contentType: info.contentType };
  } catch {
    return null;
  }
}

export async function removeStoredFile(url: string): Promise<void> {
  const local = localPath(url);
  if (local) await unlink(local).catch(() => undefined);
  else if (isBlobUrl(url)) await del(url);
}

/** Streams a stored file (for the permission-checked download route). */
export async function openStoredFile(url: string): Promise<ReadableStream<Uint8Array> | null> {
  const local = localPath(url);
  if (local) {
    try {
      const data = await readFile(local);
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(data));
          controller.close();
        },
      });
    } catch {
      return null;
    }
  }
  if (!isBlobUrl(url)) return null;
  const res = await fetch(url, { cache: "no-store" });
  return res.ok ? res.body : null;
}
