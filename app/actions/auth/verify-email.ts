"use server";

import { parseInput, runAction } from "@/lib/actions";
import { consumeVerificationToken } from "@/lib/redis/verification";
import { getUser, setAccountStatus } from "@/lib/redis/users";
import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { verifyTokenSchema } from "@/schemas/auth.schema";
import type { ActionResult } from "@/types/action";

/**
 * Consumes a single-use verification token. Done in a POST action rather
 * than on page load so link scanners that prefetch URLs can't use it up.
 * Google sign-ins are verified by the provider; this path exists for
 * accounts an admin marks for re-verification or imported accounts.
 */
export async function verifyEmailAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  return runAction("verifyEmail", async () => {
    const { token } = parseInput(verifyTokenSchema, input);
    // Unauthenticated, so limit by client address (best effort behind proxies).
    const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await enforceRateLimit("verify", forwarded);
    const payload = await consumeVerificationToken(token);
    if (!payload) throw new AppError("Tautan tidak valid atau sudah kedaluwarsa.");
    const user = await getUser(payload.userId);
    if (!user || user.email !== payload.email.toLowerCase()) throw new AppError("Tautan ini tidak lagi cocok dengan akun mana pun.");
    if (user.status === "SUSPENDED") throw new AppError("Akun ini sedang ditangguhkan.");
    await setAccountStatus(user.id, "VERIFIED");
    return { email: user.email };
  });
}
