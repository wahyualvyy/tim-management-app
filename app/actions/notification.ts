"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function markAsRead(notificationId: string) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { is_read: true },
  });

  revalidatePath("/dashboard/notifications");
}
