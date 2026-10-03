"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { getUser, setAccountStatus, setGlobalRole } from "@/lib/redis/users";
import { AppError, NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { createVerificationToken } from "@/lib/redis/verification";
import { setAccountStatusSchema, setGlobalRoleSchema, userIdSchema } from "@/schemas/admin.schema";
import type { ActionResult } from "@/types/action";

export async function setAccountStatusAction(input: unknown): Promise<ActionResult> {
  return runAction("setAccountStatus", async () => {
    const admin = await requireAdmin();
    const { userId, status } = parseInput(setAccountStatusSchema, input);
    if (userId === admin.id) throw new AppError("Anda tidak dapat mengubah status akun sendiri.");
    if (!(await getUser(userId))) throw new NotFoundError("Pengguna tidak ditemukan.");
    await setAccountStatus(userId, status);
    revalidateApp();
    return undefined;
  });
}

/**
 * Creates a single-use, 24-hour verification link for an unverified account.
 * The admin shares it with the user; opening it marks the account verified.
 */
export async function createVerificationLinkAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  return runAction("createVerificationLink", async () => {
    await requireAdmin();
    const { userId } = parseInput(userIdSchema, input);
    const user = await getUser(userId);
    if (!user) throw new NotFoundError("Pengguna tidak ditemukan.");
    if (user.status !== "UNVERIFIED") throw new AppError("Akun ini tidak menunggu verifikasi.");
    const token = await createVerificationToken(user.id, user.email);
    const base = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    return { url: `${base}/verify?token=${token}` };
  });
}

export async function setGlobalRoleAction(input: unknown): Promise<ActionResult> {
  return runAction("setGlobalRole", async () => {
    const admin = await requireAdmin();
    const { userId, role } = parseInput(setGlobalRoleSchema, input);
    if (userId === admin.id) throw new AppError("Anda tidak dapat mengubah peran sendiri.");
    if (!(await getUser(userId))) throw new NotFoundError("Pengguna tidak ditemukan.");
    await setGlobalRole(userId, role);
    revalidateApp();
    return undefined;
  });
}
