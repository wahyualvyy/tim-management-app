"use server";

import { requireAuth, requireProjectAccess, requireProjectRole } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { updateProject } from "@/lib/redis/projects";
import { recordActivity } from "@/lib/redis/activities";
import { canEditProject } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { projectStatusSchema, updateProjectSchema } from "@/schemas/project.schema";
import type { ActionResult } from "@/types/action";

export async function updateProjectAction(input: unknown): Promise<ActionResult> {
  return runAction("updateProject", async () => {
    const user = await requireAuth();
    const { projectId, ...values } = parseInput(updateProjectSchema, input);
    const { project } = await requireProjectRole(user, projectId, canEditProject);
    // Archiving goes through the status action so it is always deliberate.
    const status = values.status === "ARCHIVED" ? project.status : values.status;
    await updateProject(project, { ...values, status });
    await recordActivity({ type: "project.updated", projectId, actorId: user.id, subject: values.name });
    revalidateApp();
    return undefined;
  });
}

/** Changes the project status, including archiving and reactivating (the only change allowed while archived). */
export async function setProjectStatusAction(input: unknown): Promise<ActionResult> {
  return runAction("setProjectStatus", async () => {
    const user = await requireAuth();
    const { projectId, status } = parseInput(projectStatusSchema, input);
    const { project, role } = await requireProjectAccess(user, projectId);
    if (!canEditProject(role)) throw new ForbiddenError("Hanya pemilik proyek yang dapat mengubah status.");
    if (project.status === status) return undefined;
    await updateProject(project, { status });
    await recordActivity({
      type: "project.status_changed",
      projectId,
      actorId: user.id,
      subject: project.name,
      meta: { from: project.status, to: status },
    });
    revalidateApp();
    return undefined;
  });
}
