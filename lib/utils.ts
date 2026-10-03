import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Up to two initials from words that start with a letter ("Alice Wijaya (Anda)" → "AW"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => /^\p{L}/u.test(p));
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Only allow same-site relative paths, to avoid open redirects. */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

export function taskRef(projectKey: string, taskNumber: number): string {
  return `${projectKey}-${taskNumber}`;
}

export function taskHref(projectId: string, taskId: string): string {
  return `/projects/${projectId}/board?task=${taskId}`;
}
