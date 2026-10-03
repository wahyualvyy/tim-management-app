"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { requireProjectWrite } from "@/lib/domain/access";
import { notify } from "@/lib/domain/notify";
import { getModule } from "@/lib/redis/repositories/module.repository";
import { getMemberRole } from "@/lib/redis/repositories/project.repository";
import { createTask } from "@/lib/redis/repositories/task.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { atLeast, canAssignTo, canCreateTask } from "@/lib/permissions";
import { AppError, ForbiddenError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { taskHref, taskRef } from "@/lib/utils";
import { createTaskSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";

export async function createTaskAction(input: unknown): Promise<ActionResult<{ taskId: string }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const values = parseInput(createTaskSchema, input);
    const { project, role } = await requireProjectWrite(values.projectId, user.id, canCreateTask);

    const mod = await getModule(values.moduleId);
    if (!mod || mod.projectId !== project.id) throw new AppError("Choose a module in this project.");
    if (!canAssignTo(role, user.id, values.assigneeId)) {
      throw new ForbiddenError("Members can only assign tasks to themselves.");
    }
    if (values.assigneeId && !atLeast(await getMemberRole(project.id, values.assigneeId), "MEMBER")) {
      throw new AppError("Tasks can only be assigned to members who can work on them.");
    }

    const task = await createTask(values, user.id, project.key);
    const ref = taskRef(project.key, task.number);
    await recordActivity({
      type: "task.created",
      projectId: project.id,
      actorId: user.id,
      taskId: task.id,
      subject: task.title,
      meta: { ref, module: mod.name },
    });
    if (task.assigneeId && task.assigneeId !== user.id) {
      await notify([task.assigneeId], user.id, {
        type: "task.assigned",
        title: `${user.name} assigned you ${ref}`,
        body: task.title,
        href: taskHref(project.id, task.id),
      });
    }
    revalidateApp();
    return { taskId: task.id };
  });
}
