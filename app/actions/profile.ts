"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const github_username = formData.get("github_username") as string;

  if (!name) {
    throw new Error("Nama wajib diisi");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      github_username,
      github_url: github_username
        ? `https://github.com/${github_username}`
        : null,
    },
  });

  revalidatePath("/dashboard/profile");
}
