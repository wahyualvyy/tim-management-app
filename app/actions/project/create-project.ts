"use server";

import { requireAuth } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { createProject } from "@/lib/redis/projects";
import { createModule } from "@/lib/redis/modules";
import { recordActivity } from "@/lib/redis/activities";
import { revalidateApp } from "@/lib/revalidate";
import { createProjectSchema } from "@/schemas/project.schema";
import type { ActionResult } from "@/types/action";

export async function createProjectAction(input: unknown): Promise<ActionResult<{ projectId: string }>> {
  return runAction("createProject", async () => {
    const user = await requireAuth();
    const values = parseInput(createProjectSchema, input);
    const project = await createProject(values, user);
    // Every project starts with one module so the first task has a home.
    await createModule(project.id, { name: "Umum", description: "", status: "IN_PROGRESS", leadId: null });
    await recordActivity({ type: "project.created", projectId: project.id, actorId: user.id, subject: project.name });
    revalidateApp();
    return { projectId: project.id };
  });
}
