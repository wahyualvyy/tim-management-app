"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createTask(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const project_id = formData.get("project_id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const assigned_to = formData.get("assigned_to") as string;
  const priority = formData.get("priority") as "LOW" | "MEDIUM" | "HIGH";
  const deadline = formData.get("deadline") as string;

  if (!title || !project_id) {
    throw new Error("Judul dan ID Proyek wajib diisi");
  }

  await prisma.task.create({
    data: {
      project_id,
      title,
      description,
      assigned_to: assigned_to || null,
      priority: priority || "MEDIUM",
      status: "TODO",
      deadline: deadline ? new Date(deadline) : null,
      created_by: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects/${project_id}`);
  redirect(`/dashboard/projects/${project_id}`);
}

export async function updateTaskStatus(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const task_id = formData.get("task_id") as string;
  const project_id = formData.get("project_id") as string;
  const status = formData.get("status") as "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

  await prisma.task.update({
    where: { id: task_id },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      user_id: session.user.id,
      action: `Mengubah status task menjadi ${status.replace("_", " ")}`,
      target_type: "TASK",
      target_id: task_id,
    },
  });

  revalidatePath(`/dashboard/projects/${project_id}/tasks/${task_id}`);
  revalidatePath(`/dashboard/projects/${project_id}`);
}