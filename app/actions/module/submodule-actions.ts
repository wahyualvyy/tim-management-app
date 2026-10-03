"use server";

import { requireAuth, requireProjectRole } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import {
  createSubModule,
  deleteSubModuleCascade,
  getModule,
  getSubModule,
  reorderSubModules,
  updateSubModule,
} from "@/lib/redis/modules";
import { recordActivity } from "@/lib/redis/activities";
import { assertLeadIsMember } from "@/lib/domain/structure";
import { canManageStructure } from "@/lib/permissions";
import { NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import {
  createSubModuleSchema,
  reorderSubModulesSchema,
  subModuleIdSchema,
  updateSubModuleSchema,
} from "@/schemas/module.schema";
import type { ActionResult } from "@/types/action";

export async function createSubModuleAction(input: unknown): Promise<ActionResult<{ subModuleId: string }>> {
  return runAction("createSubModule", async () => {
    const user = await requireAuth();
    const { moduleId, ...values } = parseInput(createSubModuleSchema, input);
    const mod = await getModule(moduleId);
    if (!mod) throw new NotFoundError("Modul tidak ditemukan.");
    await requireProjectRole(user, mod.projectId, canManageStructure);
    await assertLeadIsMember(mod.projectId, values.leadId);
    const sub = await createSubModule(mod, values);
    await recordActivity({
      type: "submodule.created",
      projectId: mod.projectId,
      actorId: user.id,
      subject: `${mod.name} / ${sub.name}`,
    });
    revalidateApp();
    return { subModuleId: sub.id };
  });
}

export async function updateSubModuleAction(input: unknown): Promise<ActionResult> {
  return runAction("updateSubModule", async () => {
    const user = await requireAuth();
    const { subModuleId, ...values } = parseInput(updateSubModuleSchema, input);
    const sub = await getSubModule(subModuleId);
    if (!sub) throw new NotFoundError("Sub modul tidak ditemukan.");
    await requireProjectRole(user, sub.projectId, canManageStructure);
    await assertLeadIsMember(sub.projectId, values.leadId);
    await updateSubModule(sub, values);
    await recordActivity({ type: "submodule.updated", projectId: sub.projectId, actorId: user.id, subject: values.name });
    revalidateApp();
    return undefined;
  });
}

export async function deleteSubModuleAction(input: unknown): Promise<ActionResult<{ removedTasks: number }>> {
  return runAction("deleteSubModule", async () => {
    const user = await requireAuth();
    const { subModuleId } = parseInput(subModuleIdSchema, input);
    const sub = await getSubModule(subModuleId);
    if (!sub) throw new NotFoundError("Sub modul tidak ditemukan.");
    await requireProjectRole(user, sub.projectId, canManageStructure);
    const removedTasks = await deleteSubModuleCascade(sub);
    await recordActivity({ type: "submodule.deleted", projectId: sub.projectId, actorId: user.id, subject: sub.name });
    revalidateApp();
    return { removedTasks };
  });
}

export async function reorderSubModulesAction(input: unknown): Promise<ActionResult> {
  return runAction("reorderSubModules", async () => {
    const user = await requireAuth();
    const { moduleId, subModuleIds } = parseInput(reorderSubModulesSchema, input);
    const mod = await getModule(moduleId);
    if (!mod) throw new NotFoundError("Modul tidak ditemukan.");
    await requireProjectRole(user, mod.projectId, canManageStructure);
    await reorderSubModules(moduleId, subModuleIds);
    revalidateApp();
    return undefined;
  });
}
