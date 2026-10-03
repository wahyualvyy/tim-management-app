"use server";

import { parseInput, runAction } from "@/lib/actions";
import { consumeVerificationToken } from "@/lib/redis/repositories/verification.repository";
import { getUser, markEmailVerified } from "@/lib/redis/repositories/user.repository";
import { AppError } from "@/lib/errors";
import { verifyTokenSchema } from "@/schemas/auth.schema";
import type { ActionResult } from "@/types/action";

/**
 * Consumes a single-use verification token. Done in a POST action rather
 * than on page load so link scanners that prefetch URLs can't use it up.
 */
export async function verifyEmailAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  return runAction(async () => {
    const { token } = parseInput(verifyTokenSchema, input);
    const payload = await consumeVerificationToken(token);
    if (!payload) throw new AppError("This link is invalid or has expired.");
    const user = await getUser(payload.userId);
    // The token only verifies the email it was issued for.
    if (!user || user.email !== payload.email.toLowerCase()) {
      throw new AppError("This link no longer matches an account.");
    }
    await markEmailVerified(user.id);
    return { email: user.email };
  });
}
