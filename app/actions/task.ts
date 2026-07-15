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

  if (assigned_to && assigned_to !== session.user.id) {
    await prisma.notification.create({
      data: {
        user_id: assigned_to,
        message: `Anda telah ditugaskan untuk tugas baru: "${title}"`,
      },
    });
  }

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
  const status = formData.get("status") as
    | "TODO"
    | "IN_PROGRESS"
    | "REVIEW"
    | "DONE";

  const oldTask = await prisma.task.findUnique({
    where: { id: task_id },
  });

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
      project_id,
    },
  });

  if (oldTask && oldTask.created_by !== session.user.id) {
    await prisma.notification.create({
      data: {
        user_id: oldTask.created_by,
        message: `Status tugas "${oldTask.title}" diubah menjadi ${status.replace("_", " ")}`,
      },
    });
  }

  revalidatePath(`/dashboard/projects/${project_id}/tasks/${task_id}`);
  revalidatePath(`/dashboard/projects/${project_id}`);
}

export async function updateTask(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const task_id = formData.get("task_id") as string;
  const project_id = formData.get("project_id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const assigned_to = formData.get("assigned_to") as string;
  const priority = formData.get("priority") as "LOW" | "MEDIUM" | "HIGH";
  const deadline = formData.get("deadline") as string;

  if (!title || !task_id || !project_id) {
    throw new Error("Data tidak lengkap");
  }

  await prisma.task.update({
    where: { id: task_id },
    data: {
      title,
      description,
      assigned_to: assigned_to || null,
      priority,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  await prisma.activityLog.create({
    data: {
      user_id: session.user.id,
      action: `Memperbarui detail task: "${title}"`,
      target_type: "TASK",
      target_id: task_id,
      project_id,
    },
  });

  revalidatePath(`/dashboard/projects/${project_id}/tasks/${task_id}`);
  redirect(`/dashboard/projects/${project_id}/tasks/${task_id}`);
}

export async function deleteTask(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const task_id = formData.get("task_id") as string;
  const project_id = formData.get("project_id") as string;

  const task = await prisma.task.findUnique({
    where: { id: task_id },
  });

  if (!task) {
    throw new Error("Task tidak ditemukan");
  }

  await prisma.task.delete({
    where: { id: task_id },
  });

  await prisma.activityLog.create({
    data: {
      user_id: session.user.id,
      action: `Menghapus task: "${task.title}"`,
      target_type: "TASK",
      target_id: task_id,
      project_id,
    },
  });

  revalidatePath(`/dashboard/projects/${project_id}`);
  redirect(`/dashboard/projects/${project_id}`);
}

export async function logTime(taskId: string, durationInSeconds: number) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) throw new Error("Unauthorized");

  await prisma.timeLog.create({
    data: {
      task_id: taskId,
      user_id: session.user.id,
      duration: durationInSeconds,
    },
  });

  revalidatePath(`/dashboard/projects`);
}

export async function completeTask(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) throw new Error("Unauthorized");

  const taskId = formData.get("task_id") as string;
  const notes = formData.get("notes") as string;
  const proofImageBase64 = formData.get("proof_image") as string; 
  const projectId = formData.get("project_id") as string;

  if (!taskId) throw new Error("Task ID wajib diisi");

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "DONE",
      notes: notes || null,
      proof_image: proofImageBase64 || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      user_id: session.user.id,
      action: `Menyelesaikan task dengan memberikan bukti foto`,
      target_type: "TASK",
      target_id: taskId,
      project_id: projectId,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
}
