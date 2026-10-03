"use server";

import { requireAuth, requireProjectRole } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { createModule, deleteModuleCascade, getModule, reorderModules, updateModule } from "@/lib/redis/modules";
import { assertLeadIsMember } from "@/lib/domain/structure";
import { recordActivity } from "@/lib/redis/activities";
import { canManageStructure } from "@/lib/permissions";
import { NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { createModuleSchema, moduleIdSchema, reorderModulesSchema, updateModuleSchema } from "@/schemas/module.schema";
import type { ActionResult } from "@/types/action";

export async function createModuleAction(input: unknown): Promise<ActionResult<{ moduleId: string }>> {
  return runAction("createModule", async () => {
    const user = await requireAuth();
    const { projectId, ...values } = parseInput(createModuleSchema, input);
    await requireProjectRole(user, projectId, canManageStructure);
    await assertLeadIsMember(projectId, values.leadId);
    const mod = await createModule(projectId, values);
    await recordActivity({ type: "module.created", projectId, actorId: user.id, subject: mod.name });
    revalidateApp();
    return { moduleId: mod.id };
  });
}

export async function updateModuleAction(input: unknown): Promise<ActionResult> {
  return runAction("updateModule", async () => {
    const user = await requireAuth();
    const { moduleId, ...values } = parseInput(updateModuleSchema, input);
    const mod = await getModule(moduleId);
    if (!mod) throw new NotFoundError("Modul tidak ditemukan.");
    await requireProjectRole(user, mod.projectId, canManageStructure);
    await assertLeadIsMember(mod.projectId, values.leadId);
    await updateModule(mod, values);
    await recordActivity({ type: "module.updated", projectId: mod.projectId, actorId: user.id, subject: values.name });
    revalidateApp();
    return undefined;
  });
}

/** Deletes the module with its sub modules and tasks (confirmed in the UI with counts). */
export async function deleteModuleAction(input: unknown): Promise<ActionResult<{ removedTasks: number }>> {
  return runAction("deleteModule", async () => {
    const user = await requireAuth();
    const { moduleId } = parseInput(moduleIdSchema, input);
    const mod = await getModule(moduleId);
    if (!mod) throw new NotFoundError("Modul tidak ditemukan.");
    await requireProjectRole(user, mod.projectId, canManageStructure);
    const removedTasks = await deleteModuleCascade(mod);
    await recordActivity({
      type: "module.deleted",
      projectId: mod.projectId,
      actorId: user.id,
      subject: mod.name,
      meta: { tasks: String(removedTasks) },
    });
    revalidateApp();
    return { removedTasks };
  });
}

export async function reorderModulesAction(input: unknown): Promise<ActionResult> {
  return runAction("reorderModules", async () => {
    const user = await requireAuth();
    const { projectId, moduleIds } = parseInput(reorderModulesSchema, input);
    await requireProjectRole(user, projectId, canManageStructure);
    await reorderModules(projectId, moduleIds);
    revalidateApp();
    return undefined;
  });
}
