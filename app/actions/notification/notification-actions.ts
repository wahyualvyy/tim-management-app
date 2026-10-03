"use server";

import { z } from "zod";
import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { markAllRead, markRead } from "@/lib/redis/repositories/notification.repository";
import { revalidateApp } from "@/lib/revalidate";
import { idSchema } from "@/schemas/common";
import type { ActionResult } from "@/types/action";

const markReadSchema = z.object({ notificationId: idSchema });

export async function markNotificationReadAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { notificationId } = parseInput(markReadSchema, input);
    // Operates on the caller's own unread set only, so ids from other users have no effect.
    await markRead(user.id, notificationId);
    revalidateApp();
    return undefined;
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await markAllRead(user.id);
    revalidateApp();
    return undefined;
  });
}
