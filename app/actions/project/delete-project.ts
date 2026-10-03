"use server";

import { redirect } from "next/navigation";
import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { getProjectAccess } from "@/lib/domain/access";
import { deleteProjectCascade } from "@/lib/redis/repositories/project.repository";
import { canDeleteProject } from "@/lib/permissions";
import { AppError, ForbiddenError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { deleteProjectSchema } from "@/schemas/project.schema";
import type { ActionResult } from "@/types/action";

export async function deleteProjectAction(input: unknown): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireActionUser();
    const { projectId, confirmKey } = parseInput(deleteProjectSchema, input);
    const { project, role } = await getProjectAccess(projectId, user.id);
    if (!canDeleteProject(role)) throw new ForbiddenError("Only the project owner can delete it.");
    if (confirmKey !== project.key) throw new AppError(`Type ${project.key} to confirm.`);
    await deleteProjectCascade(project);
    revalidateApp();
    return undefined;
  });
  if (result.ok) redirect("/projects");
  return result;
}
