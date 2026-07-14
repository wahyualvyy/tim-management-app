"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addProjectMember(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const project_id = formData.get("project_id") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as "LEAD" | "MEMBER" | "VIEWER";

  if (!email || !project_id) {
    throw new Error("Email dan ID Proyek wajib diisi");
  }

  const targetUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!targetUser) {
    throw new Error("Pengguna dengan email tersebut tidak ditemukan");
  }

  const existingMember = await prisma.projectMember.findUnique({
    where: {
      project_id_user_id: {
        project_id,
        user_id: targetUser.id,
      },
    },
  });

  if (existingMember) {
    throw new Error("Pengguna sudah menjadi anggota proyek ini");
  }

  await prisma.projectMember.create({
    data: {
      project_id,
      user_id: targetUser.id,
      role: role || "MEMBER",
    },
  });

  await prisma.activityLog.create({
    data: {
      user_id: session.user.id,
      action: `Menambahkan ${targetUser.name || email} ke dalam tim`,
      target_type: "MEMBER",
      target_id: targetUser.id,
      project_id,
    },
  });

  revalidatePath(`/dashboard/projects/${project_id}`);
}
