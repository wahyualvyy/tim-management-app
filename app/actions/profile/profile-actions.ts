"use server";

import { requireAuth } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { bumpSessionVersion, changeUsername, normalizeUsername, reindexUserSearch, updateUser } from "@/lib/redis/users";
import { reindexMemberEverywhere } from "@/lib/redis/members";
import { isOwnedFile, removeStoredFile } from "@/lib/storage";
import { revalidateApp } from "@/lib/revalidate";
import { themeSchema, updateProfileSchema } from "@/schemas/profile.schema";
import type { ActionResult } from "@/types/action";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return runAction("updateProfile", async () => {
    const user = await requireAuth();
    const { username, ...values } = parseInput(updateProfileSchema, input);
    await changeUsername(user, username);
    await updateUser(user.id, values);
    // Names and usernames are indexed for search and member lists everywhere the user appears.
    const after = { id: user.id, name: values.name, username: normalizeUsername(username), email: user.email };
    await reindexUserSearch(user, after);
    await reindexMemberEverywhere(user, after);
    revalidateApp();
    return undefined;
  });
}

/** Invalidates every session of this user, including the current one. */
export async function signOutEverywhereAction(): Promise<ActionResult> {
  return runAction("signOutEverywhere", async () => {
    const user = await requireAuth();
    await bumpSessionVersion(user.id);
    return undefined;
  });
}

/** Switch back to the photo from the Google account. */
export async function resetAvatarAction(): Promise<ActionResult> {
  return runAction("resetAvatar", async () => {
    const user = await requireAuth();
    if (user.avatar && isOwnedFile(user.avatar)) await removeStoredFile(user.avatar).catch(() => undefined);
    await updateUser(user.id, { avatar: user.providerAvatar });
    revalidateApp();
    return undefined;
  });
}

export async function setThemeAction(input: unknown): Promise<ActionResult> {
  return runAction("setTheme", async () => {
    const user = await requireAuth();
    const { theme } = parseInput(themeSchema, input);
    await updateUser(user.id, { themePreference: theme });
    return undefined;
  });
}
