"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createProject(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const start_date = formData.get("start_date") as string;
  const deadline = formData.get("deadline") as string;

  if (!name) {
    throw new Error("Nama proyek wajib diisi");
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      start_date: start_date ? new Date(start_date) : null,
      deadline: deadline ? new Date(deadline) : null,
      created_by: session.user.id,
      status: "ACTIVE",
      members: {
        create: {
          user_id: session.user.id,
          role: "LEAD",
        },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      user_id: session.user.id,
      action: `Membuat proyek: "${name}"`,
      target_type: "PROJECT",
      target_id: project.id,
      project_id: project.id,
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${project.id}`);
}

export async function updateProject(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id") as string;

  // Validasi Hak Akses
  const member = await prisma.projectMember.findUnique({
    where: { project_id_user_id: { project_id: id, user_id: session.user.id } },
  });

  if (!member || member.role !== "LEAD") {
    throw new Error(
      "Akses ditolak: Hanya LEAD yang dapat mengubah pengaturan proyek.",
    );
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const status = formData.get("status") as "ACTIVE" | "COMPLETED" | "ARCHIVED";
  const start_date = formData.get("start_date") as string;
  const deadline = formData.get("deadline") as string;

  if (!id || !name) {
    throw new Error("Nama proyek wajib diisi");
  }

  await prisma.project.update({
    where: { id },
    data: {
      name,
      description,
      status,
      start_date: start_date ? new Date(start_date) : null,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${id}`);
}

export async function deleteProject(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id") as string;

  const member = await prisma.projectMember.findUnique({
    where: { project_id_user_id: { project_id: id, user_id: session.user.id } },
  });

  if (!member || member.role !== "LEAD") {
    throw new Error("Akses ditolak: Hanya LEAD yang dapat menghapus proyek.");
  }

  await prisma.project.delete({
    where: { id },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
