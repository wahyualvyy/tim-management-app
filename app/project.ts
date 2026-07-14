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
      members: {
        create: {
          user_id: session.user.id,
          role: "LEAD",
        },
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${project.id}`);
}
