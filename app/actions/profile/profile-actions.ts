"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { updateUser } from "@/lib/redis/repositories/user.repository";
import { AppError } from "@/lib/errors";
import { AVATAR_MAX_BYTES, AVATAR_TYPES, getStorage } from "@/lib/storage";
import { revalidateApp } from "@/lib/revalidate";
import { themeSchema, updateProfileSchema } from "@/schemas/profile.schema";
import type { ActionResult } from "@/types/action";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const values = parseInput(updateProfileSchema, input);
    await updateUser(user.id, values);
    revalidateApp();
    return undefined;
  });
}

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw new AppError("Choose an image to upload.");
    if (!AVATAR_TYPES.includes(file.type)) throw new AppError("Use a PNG, JPEG, WebP or GIF image.");
    if (file.size > AVATAR_MAX_BYTES) throw new AppError("Images must be 2 MB or smaller.");
    const storage = getStorage();
    if (!storage) throw new AppError("Image uploads are not configured on this server.");

    const { url } = await storage.upload(`avatars/${user.id}`, file);
    const previous = user.avatar;
    await updateUser(user.id, { avatar: url });
    // Only delete files this app uploaded, never the Google profile photo.
    if (previous && previous.includes(".blob.vercel-storage.com")) {
      await storage.remove(previous).catch(() => undefined);
    }
    revalidateApp();
    return { url };
  });
}

export async function removeAvatarAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    if (user.avatar?.includes(".blob.vercel-storage.com")) {
      await getStorage()?.remove(user.avatar).catch(() => undefined);
    }
    await updateUser(user.id, { avatar: null });
    revalidateApp();
    return undefined;
  });
}

export async function setThemeAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { theme } = parseInput(themeSchema, input);
    await updateUser(user.id, { themePreference: theme });
    return undefined;
  });
}
