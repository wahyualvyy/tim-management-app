"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { createProject } from "@/lib/redis/repositories/project.repository";
import { createModule } from "@/lib/redis/repositories/module.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { revalidateApp } from "@/lib/revalidate";
import { createProjectSchema } from "@/schemas/project.schema";
import type { ActionResult } from "@/types/action";

export async function createProjectAction(input: unknown): Promise<ActionResult<{ projectId: string }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const values = parseInput(createProjectSchema, input);
    const project = await createProject(values, user.id);
    // Every project starts with one module so tasks always have a home.
    await createModule(project.id, { name: "General", description: "", status: "IN_PROGRESS", ownerId: null });
    await recordActivity({ type: "project.created", projectId: project.id, actorId: user.id, subject: project.name });
    revalidateApp();
    return { projectId: project.id };
  });
}
