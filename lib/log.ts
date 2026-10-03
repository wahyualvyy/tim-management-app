/**
 * Server-side error logging without secrets or bulky personal data.
 * Upstash errors embed the full command (keys and values) in their message;
 * that part is cut off. Tokens, cookies and bearer strings are masked.
 */
const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(token|secret|password|cookie|authorization)(["'\s:=]+)[^\s"',}]+/gi,
  /https?:\/\/[^\s"']*upstash\.io[^\s"']*/gi,
  /vercel_blob_rw_[A-Za-z0-9_]+/gi,
];

export function sanitizeMessage(message: string): string {
  let out = message.split(", command was:")[0] ?? message;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, name?: string, sep?: string) => (name && sep ? `${name}${sep}[redacted]` : "[redacted]"));
  }
  return out.slice(0, 500);
}

export function logError(context: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && process.env.NODE_ENV !== "production" ? `\n${error.stack ?? ""}` : "";
  console.error(`[${context}] ${name}: ${sanitizeMessage(message)}${stack}`);
}
