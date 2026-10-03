"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { requireProjectWrite } from "@/lib/domain/access";
import {
  createModule,
  deleteModule,
  getModule,
  reorderModules,
  updateModule,
} from "@/lib/redis/repositories/module.repository";
import { getMemberRole } from "@/lib/redis/repositories/project.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { canManageModules } from "@/lib/permissions";
import { AppError, NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import {
  createModuleSchema,
  moduleIdSchema,
  reorderModulesSchema,
  updateModuleSchema,
} from "@/schemas/module.schema";
import type { ActionResult } from "@/types/action";

async function assertOwnerIsMember(projectId: string, ownerId: string | null): Promise<void> {
  if (ownerId && !(await getMemberRole(projectId, ownerId))) {
    throw new AppError("The module owner must be a project member.");
  }
}

export async function createModuleAction(input: unknown): Promise<ActionResult<{ moduleId: string }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { projectId, ...values } = parseInput(createModuleSchema, input);
    await requireProjectWrite(projectId, user.id, canManageModules);
    await assertOwnerIsMember(projectId, values.ownerId);
    const mod = await createModule(projectId, values);
    await recordActivity({ type: "module.created", projectId, actorId: user.id, subject: mod.name });
    revalidateApp();
    return { moduleId: mod.id };
  });
}

export async function updateModuleAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { moduleId, ...values } = parseInput(updateModuleSchema, input);
    const mod = await getModule(moduleId);
    if (!mod) throw new NotFoundError("Module not found.");
    await requireProjectWrite(mod.projectId, user.id, canManageModules);
    await assertOwnerIsMember(mod.projectId, values.ownerId);
    await updateModule(mod, values);
    await recordActivity({ type: "module.updated", projectId: mod.projectId, actorId: user.id, subject: values.name });
    revalidateApp();
    return undefined;
  });
}

export async function deleteModuleAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { moduleId } = parseInput(moduleIdSchema, input);
    const mod = await getModule(moduleId);
    if (!mod) throw new NotFoundError("Module not found.");
    await requireProjectWrite(mod.projectId, user.id, canManageModules);
    await deleteModule(mod);
    await recordActivity({ type: "module.deleted", projectId: mod.projectId, actorId: user.id, subject: mod.name });
    revalidateApp();
    return undefined;
  });
}

export async function reorderModulesAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { projectId, moduleIds } = parseInput(reorderModulesSchema, input);
    await requireProjectWrite(projectId, user.id, canManageModules);
    await reorderModules(projectId, moduleIds);
    revalidateApp();
    return undefined;
  });
}
