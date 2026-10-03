"use server";

import { requireAuth, requireProjectRole } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { notify } from "@/lib/domain/notify";
import { resolvePlacement } from "@/lib/domain/structure";
import { assertAssignable } from "@/lib/domain/task-rules";
import { createTask } from "@/lib/redis/tasks";
import { recordActivity } from "@/lib/redis/activities";
import { canChangeAssignees, canCreateTask } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { revalidateApp } from "@/lib/revalidate";
import { taskHref, taskRef } from "@/lib/utils";
import { createTaskSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";

export async function createTaskAction(input: unknown): Promise<ActionResult<{ taskId: string }>> {
  return runAction("createTask", async () => {
    const user = await requireAuth();
    const { placeOnTop, ...values } = parseInput(createTaskSchema, input);
    const { project, role } = await requireProjectRole(user, values.projectId, canCreateTask);
    await enforceRateLimit("createTask", user.id);
    const { moduleName, subModuleName } = await resolvePlacement(project.id, values.moduleId, values.subModuleId);
    if (!canChangeAssignees(role, user.id, [], values.assigneeIds)) {
      throw new ForbiddenError("Anggota hanya dapat menugaskan dirinya sendiri.");
    }
    await assertAssignable(project.id, values.assigneeIds);

    // The creator id always comes from the session.
    const task = await createTask({ ...values, order: placeOnTop ? -Date.now() : undefined }, user.id, project.key);
    const ref = taskRef(project.key, task.number);
    await recordActivity({
      type: "task.created",
      projectId: project.id,
      actorId: user.id,
      taskId: task.id,
      subject: task.title,
      meta: { ref, module: subModuleName ? `${moduleName} / ${subModuleName}` : moduleName },
    });
    await notify(task.assigneeIds, user.id, {
      type: "task.assigned",
      title: `${user.name} menugaskan ${ref} kepada Anda`,
      body: task.title,
      href: taskHref(project.id, task.id),
    });
    revalidateApp();
    return { taskId: task.id };
  });
}
