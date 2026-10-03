"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { markAllRead, markRead } from "@/lib/redis/notifications";
import { revalidateApp } from "@/lib/revalidate";
import { idSchema } from "@/schemas/common";
import type { ActionResult } from "@/types/action";

const markReadSchema = z.object({ notificationId: idSchema });

export async function markNotificationReadAction(input: unknown): Promise<ActionResult> {
  return runAction("markNotificationRead", async () => {
    const user = await requireAuth();
    const { notificationId } = parseInput(markReadSchema, input);
    // Touches only the caller's own unread set, so foreign ids have no effect.
    await markRead(user.id, notificationId);
    revalidateApp();
    return undefined;
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return runAction("markAllNotificationsRead", async () => {
    const user = await requireAuth();
    await markAllRead(user.id);
    revalidateApp();
    return undefined;
  });
}
