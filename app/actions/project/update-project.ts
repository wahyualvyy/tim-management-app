"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { requireProjectWrite } from "@/lib/domain/access";
import { updateProject } from "@/lib/redis/repositories/project.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { canEditProject } from "@/lib/permissions";
import { revalidateApp } from "@/lib/revalidate";
import { updateProjectSchema } from "@/schemas/project.schema";
import type { ActionResult } from "@/types/action";

export async function updateProjectAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { projectId, ...values } = parseInput(updateProjectSchema, input);
    const { project } = await requireProjectWrite(projectId, user.id, canEditProject);
    await updateProject(project, values);
    await recordActivity({ type: "project.updated", projectId, actorId: user.id, subject: values.name });
    revalidateApp();
    return undefined;
  });
}
