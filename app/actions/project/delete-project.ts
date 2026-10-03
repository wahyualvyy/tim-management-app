"use server";

import { redirect } from "next/navigation";
import { requireAuth, requireProjectAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { deleteProjectCascade } from "@/lib/redis/projects";
import { listAttachmentUrls } from "@/lib/redis/attachments";
import { listProjectTaskIds } from "@/lib/redis/tasks";
import { canDeleteProject } from "@/lib/permissions";
import { AppError, ForbiddenError } from "@/lib/errors";
import { removeStoredFile } from "@/lib/storage";
import { revalidateApp } from "@/lib/revalidate";
import { deleteProjectSchema } from "@/schemas/project.schema";
import type { ActionResult } from "@/types/action";

/**
 * Hard delete with typed confirmation. Archiving (status ARCHIVED) is the
 * recommended, reversible alternative and is offered first in the UI.
 */
export async function deleteProjectAction(input: unknown): Promise<ActionResult> {
  const result = await runAction("deleteProject", async () => {
    const user = await requireAuth();
    const { projectId, confirmKey } = parseInput(deleteProjectSchema, input);
    const { project, role } = await requireProjectAccess(user, projectId);
    if (!canDeleteProject(role)) throw new ForbiddenError("Hanya pemilik yang dapat menghapus proyek.");
    if (confirmKey !== project.key) throw new AppError(`Ketik ${project.key} untuk mengonfirmasi.`);

    const fileUrls = await listAttachmentUrls(await listProjectTaskIds(project.id));
    await deleteProjectCascade(project);
    await Promise.allSettled(fileUrls.map((url) => removeStoredFile(url)));
    revalidateApp();
    return undefined;
  });
  if (result.ok) redirect("/projects");
  return result;
}
