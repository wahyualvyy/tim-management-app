"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { assertWritable, getTaskAccess } from "@/lib/domain/access";
import { notify } from "@/lib/domain/notify";
import { getModule } from "@/lib/redis/repositories/module.repository";
import { getMemberRole } from "@/lib/redis/repositories/project.repository";
import { updateTask, type TaskPatch } from "@/lib/redis/repositories/task.repository";
import { recordActivity, type ActivityInput } from "@/lib/redis/repositories/activity.repository";
import { getUser } from "@/lib/redis/repositories/user.repository";
import { atLeast, canAssignTo, canEditTask } from "@/lib/permissions";
import { AppError, ForbiddenError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { taskHref, taskRef } from "@/lib/utils";
import { updateTaskSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";

export async function updateTaskAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { taskId, ...raw } = parseInput(updateTaskSchema, input);
    const { task, project, role } = await getTaskAccess(taskId, user.id);
    assertWritable(project);
    if (!canEditTask(role, task, user.id)) throw new ForbiddenError("You can't edit this task.");

    // Keep only fields that actually change.
    const patch: TaskPatch = {};
    for (const [field, value] of Object.entries(raw) as [keyof TaskPatch, TaskPatch[keyof TaskPatch]][]) {
      if (value === undefined) continue;
      const current = task[field];
      const same = Array.isArray(value) && Array.isArray(current)
        ? value.join("\u0000") === current.join("\u0000")
        : value === current;
      if (!same) Object.assign(patch, { [field]: value });
    }
    if (Object.keys(patch).length === 0) return undefined;

    if (patch.assigneeId !== undefined) {
      if (!canAssignTo(role, user.id, patch.assigneeId)) {
        throw new ForbiddenError("Members can only assign tasks to themselves.");
      }
      if (patch.assigneeId && !atLeast(await getMemberRole(project.id, patch.assigneeId), "MEMBER")) {
        throw new AppError("Tasks can only be assigned to members who can work on them.");
      }
    }
    let moduleName: string | null = null;
    if (patch.moduleId !== undefined) {
      const mod = await getModule(patch.moduleId);
      if (!mod || mod.projectId !== project.id) throw new AppError("Choose a module in this project.");
      moduleName = mod.name;
    }
    const startDate = patch.startDate !== undefined ? patch.startDate : task.startDate;
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : task.dueDate;
    if (startDate && dueDate && startDate > dueDate) {
      throw new AppError("Due date must be on or after the start date.");
    }

    const next = await updateTask(task, patch, project.key);
    const ref = taskRef(project.key, task.number);

    const base = { projectId: project.id, actorId: user.id, taskId: task.id, subject: next.title };
    const activities: ActivityInput[] = [];
    if (patch.assigneeId !== undefined) {
      const assignee = patch.assigneeId ? await getUser(patch.assigneeId) : null;
      activities.push({ ...base, type: "task.assigned", meta: { to: assignee?.name ?? "Unassigned" } });
      if (assignee && assignee.id !== user.id) {
        await notify([assignee.id], user.id, {
          type: "task.assigned",
          title: `${user.name} assigned you ${ref}`,
          body: next.title,
          href: taskHref(project.id, task.id),
        });
      }
    }
    if (patch.dueDate !== undefined) {
      activities.push({
        ...base,
        type: "task.due_changed",
        meta: { from: task.dueDate ?? "none", to: patch.dueDate ?? "none" },
      });
    }
    if (moduleName) activities.push({ ...base, type: "task.moved", meta: { to: moduleName } });
    const otherFields = Object.keys(patch).filter((k) => !["assigneeId", "dueDate", "moduleId"].includes(k));
    if (otherFields.length > 0) activities.push({ ...base, type: "task.updated", meta: { fields: otherFields.join(",") } });
    for (const activity of activities) await recordActivity(activity);

    revalidateApp();
    return undefined;
  });
}
