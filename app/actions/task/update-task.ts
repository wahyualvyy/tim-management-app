"use server";

import { assertWritable, requireAuth, requireTaskAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { notify } from "@/lib/domain/notify";
import { resolvePlacement } from "@/lib/domain/structure";
import { assertAssignable } from "@/lib/domain/task-rules";
import { updateTask, type TaskPatch } from "@/lib/redis/tasks";
import { recordActivity, type ActivityInput } from "@/lib/redis/activities";
import { getUsers } from "@/lib/redis/users";
import { canChangeAssignees, canManageTask } from "@/lib/permissions";
import { AppError, ForbiddenError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { taskHref, taskRef } from "@/lib/utils";
import { updateTaskSchema } from "@/schemas/task.schema";
import type { ActionResult } from "@/types/action";

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
}

export async function updateTaskAction(input: unknown): Promise<ActionResult> {
  return runAction("updateTask", async () => {
    const user = await requireAuth();
    const { taskId, ...raw } = parseInput(updateTaskSchema, input);
    const { task, project, role } = await requireTaskAccess(user, taskId);
    assertWritable(project);
    if (!canManageTask(role, task, user.id)) throw new ForbiddenError("Anda tidak dapat mengubah tugas ini.");

    // Keep only fields that actually change.
    const patch: TaskPatch = {};
    for (const [field, value] of Object.entries(raw) as [keyof TaskPatch, TaskPatch[keyof TaskPatch]][]) {
      if (value !== undefined && !sameValue(value, task[field])) Object.assign(patch, { [field]: value });
    }
    // Choosing a different module without a sub module places the task directly under it.
    if (patch.moduleId && raw.subModuleId === undefined) patch.subModuleId = null;
    if (Object.keys(patch).length === 0) return undefined;

    if (patch.assigneeIds) {
      if (!canChangeAssignees(role, user.id, task.assigneeIds, patch.assigneeIds)) {
        throw new ForbiddenError("Anggota hanya dapat menambahkan atau melepas dirinya sendiri.");
      }
      await assertAssignable(project.id, patch.assigneeIds);
    }
    let placementLabel: string | null = null;
    if (patch.moduleId !== undefined || patch.subModuleId !== undefined) {
      const moduleId = patch.moduleId ?? task.moduleId;
      const subModuleId = patch.subModuleId !== undefined ? patch.subModuleId : task.subModuleId;
      const names = await resolvePlacement(project.id, moduleId, subModuleId);
      placementLabel = names.subModuleName ? `${names.moduleName} / ${names.subModuleName}` : names.moduleName;
    }
    const startDate = patch.startDate !== undefined ? patch.startDate : task.startDate;
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : task.dueDate;
    if (startDate && dueDate && startDate > dueDate) throw new AppError("Tenggat harus pada atau setelah tanggal mulai.");

    const next = await updateTask(task, patch, project.key);
    const ref = taskRef(project.key, task.number);
    const base = { projectId: project.id, actorId: user.id, taskId: task.id, subject: next.title };
    const activities: ActivityInput[] = [];

    if (patch.assigneeIds) {
      const added = patch.assigneeIds.filter((id) => !task.assigneeIds.includes(id));
      const names = await getUsers(next.assigneeIds);
      activities.push({
        ...base,
        type: "task.assigned",
        meta: { to: next.assigneeIds.map((id) => names.get(id)?.name ?? "").filter(Boolean).join(", ") },
      });
      await notify(added, user.id, {
        type: "task.assigned",
        title: `${user.name} menugaskan ${ref} kepada Anda`,
        body: next.title,
        href: taskHref(project.id, task.id),
      });
    }
    if (patch.dueDate !== undefined) {
      activities.push({ ...base, type: "task.due_changed", meta: { from: task.dueDate ?? "none", to: patch.dueDate ?? "none" } });
    }
    if (placementLabel) activities.push({ ...base, type: "task.moved", meta: { to: placementLabel } });
    const other = Object.keys(patch).filter((k) => !["assigneeIds", "dueDate", "moduleId", "subModuleId"].includes(k));
    if (other.length > 0) activities.push({ ...base, type: "task.updated", meta: { fields: other.join(",") } });
    for (const activity of activities) await recordActivity(activity);

    revalidateApp();
    return undefined;
  });
}
