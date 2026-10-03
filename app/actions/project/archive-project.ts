"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { getProjectAccess } from "@/lib/domain/access";
import { updateProject } from "@/lib/redis/repositories/project.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { canEditProject } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { projectIdSchema } from "@/schemas/project.schema";
import type { ActionResult } from "@/types/action";

async function setArchived(input: unknown, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { projectId } = parseInput(projectIdSchema, input);
    const { project, role } = await getProjectAccess(projectId, user.id);
    if (!canEditProject(role)) throw new ForbiddenError();
    if (project.archived === archived) return undefined;
    await updateProject(project, { archived });
    await recordActivity({
      type: archived ? "project.archived" : "project.restored",
      projectId,
      actorId: user.id,
      subject: project.name,
    });
    revalidateApp();
    return undefined;
  });
}

export async function archiveProjectAction(input: unknown): Promise<ActionResult> {
  return setArchived(input, true);
}

export async function restoreProjectAction(input: unknown): Promise<ActionResult> {
  return setArchived(input, false);
}
