"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addComment(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const task_id = formData.get("task_id") as string;
  const project_id = formData.get("project_id") as string;
  const content = formData.get("content") as string;

  if (!content || !task_id) {
    throw new Error("Komentar tidak boleh kosong");
  }

  await prisma.comment.create({
    data: {
      task_id,
      user_id: session.user.id,
      content,
    },
  });

  await prisma.activityLog.create({
    data: {
      user_id: session.user.id,
      action: "Menambahkan komentar pada task",
      target_type: "COMMENT",
      target_id: task_id,
      project_id,
    },
  });

  revalidatePath(`/dashboard/projects/${project_id}/tasks/${task_id}`);
}
