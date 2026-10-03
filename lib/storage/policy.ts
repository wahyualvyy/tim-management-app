/**
 * Upload policy: what may be uploaded, how big, and how the declared type is
 * checked against the file's actual bytes (never the extension). HTML, SVG,
 * scripts and executables are never accepted.
 */
export const UPLOAD_KINDS = ["avatar", "proof", "attachment"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const MB = 1024 * 1024;

function envMb(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 100) * MB : fallback * MB;
}

const IMAGES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const DOCUMENTS = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export interface UploadPolicy {
  maxBytes: number;
  types: string[];
}

export function uploadPolicy(kind: UploadKind): UploadPolicy {
  switch (kind) {
    case "avatar":
      return { maxBytes: envMb("UPLOAD_MAX_AVATAR_MB", 5), types: IMAGES };
    case "proof":
      return { maxBytes: envMb("UPLOAD_MAX_PROOF_MB", 10), types: [...IMAGES, "application/pdf"] };
    case "attachment":
      return { maxBytes: envMb("UPLOAD_MAX_ATTACHMENT_MB", 20), types: [...IMAGES, ...DOCUMENTS] };
  }
}

/** Content family detected from the first bytes of a file. */
export type SniffedType = "png" | "jpeg" | "gif" | "webp" | "pdf" | "zip" | "text" | "unknown";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

export function sniff(bytes: Uint8Array): SniffedType {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  // Plain text: no NUL bytes, valid UTF-8, and not markup (HTML, SVG, XML) that a browser could execute.
  if (bytes.length > 0 && !bytes.includes(0)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trimStart().toLowerCase();
      if (!/^(<|﻿<)/.test(text)) return "text";
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}

const EXPECTED: Record<string, SniffedType> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "text",
  "text/csv": "text",
  "application/zip": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "zip",
};

export type UploadCheck = { ok: true } | { ok: false; reason: string };

/** Validates declared type, size and actual content for an upload kind. */
export function checkUpload(kind: UploadKind, declaredType: string, size: number, head: Uint8Array): UploadCheck {
  const policy = uploadPolicy(kind);
  if (size <= 0) return { ok: false, reason: "Berkas kosong." };
  if (size > policy.maxBytes) return { ok: false, reason: `Ukuran maksimal ${Math.round(policy.maxBytes / MB)} MB.` };
  const type = declaredType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!policy.types.includes(type)) return { ok: false, reason: "Jenis berkas tidak diizinkan." };
  if (sniff(head) !== EXPECTED[type]) return { ok: false, reason: "Isi berkas tidak sesuai dengan jenisnya." };
  return { ok: true };
}

/** Keeps letters, digits, dot, dash and underscore; strips any path. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "").slice(-100);
  return cleaned || "berkas";
}

/** Whether the browser may show the file inline (images, PDF); everything else downloads. */
export function isInlineType(type: string): boolean {
  return IMAGES.includes(type) || type === "application/pdf";
}
