import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { redis } from "./client";
import { keys } from "./keys";

const TOKEN_TTL_SECONDS = 60 * 60 * 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a single-use verification token. Only its hash is stored, with a
 * 24 hour expiry, so a leaked database snapshot cannot be used to verify.
 * Returns the raw token, which belongs in the emailed link.
 */
export async function createVerificationToken(userId: string, email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await redis().set(keys.verification(hashToken(token)), JSON.stringify({ userId, email }), {
    ex: TOKEN_TTL_SECONDS,
  });
  return token;
}

/** Atomically read and delete a token, so it can be used only once. */
export async function consumeVerificationToken(token: string): Promise<{ userId: string; email: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const raw = await redis().getdel<string>(keys.verification(hashToken(token)));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "userId" in parsed &&
      "email" in parsed &&
      typeof parsed.userId === "string" &&
      typeof parsed.email === "string"
    ) {
      return { userId: parsed.userId, email: parsed.email };
    }
  } catch {
    // fall through
  }
  return null;
}
