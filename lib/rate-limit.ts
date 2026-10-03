import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis/client";
import { AppError } from "@/lib/errors";

/**
 * Per-user rate limits for actions that are cheap to abuse. Sliding windows
 * in the same Upstash database (prefix "ratelimit:"). Limits are generous
 * for normal use and only stop scripted floods.
 */
const LIMITS = {
  search: { tokens: 60, window: "1 m" },
  comment: { tokens: 30, window: "1 m" },
  createTask: { tokens: 60, window: "1 m" },
  upload: { tokens: 30, window: "10 m" },
  invite: { tokens: 30, window: "10 m" },
  mutation: { tokens: 300, window: "1 m" },
  verify: { tokens: 10, window: "10 m" },
} as const satisfies Record<string, { tokens: number; window: `${number} ${"s" | "m" | "h"}` }>;

export type RateLimitName = keyof typeof LIMITS;

const limiters = new Map<RateLimitName, Ratelimit>();

function limiter(name: RateLimitName): Ratelimit {
  const existing = limiters.get(name);
  if (existing) return existing;
  const { tokens, window } = LIMITS[name];
  const created = new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `ratelimit:${name}`,
    analytics: false,
  });
  limiters.set(name, created);
  return created;
}

export class RateLimitError extends AppError {
  constructor() {
    super("Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.", "RATE_LIMITED");
    this.name = "RateLimitError";
  }
}

/** Throws RateLimitError when `identifier` (usually a user id) exceeded the limit. */
export async function enforceRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  if (process.env.RATE_LIMIT_DISABLED === "1") return;
  const { success } = await limiter(name).limit(identifier);
  if (!success) throw new RateLimitError();
}
