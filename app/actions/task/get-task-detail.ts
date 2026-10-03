"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { getTaskAccess } from "@/lib/domain/access";
import { getMembers } from "@/lib/redis/repositories/project.repository";
import { listModules } from "@/lib/redis/repositories/module.repository";
import { listAttachments } from "@/lib/redis/repositories/task.repository";
import { listComments } from "@/lib/redis/repositories/comment.repository";
import { listTaskTimeLogs } from "@/lib/redis/repositories/timer.repository";
import { listTaskActivity } from "@/lib/redis/repositories/activity.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
import { isStorageConfigured } from "@/lib/storage";
import {
  atLeast,
  canComment,
  canDeleteTask,
  canEditTask,
  canTrackTime,
  isWritable,
} from "@/lib/permissions";
import { taskIdSchema } from "@/schemas/task.schema";
import { toPublicUser, type PublicUser } from "@/types/user";
import type { ActionResult } from "@/types/action";
import type { TaskDetail } from "@/types/task-detail";

export async function getTaskDetailAction(input: unknown): Promise<ActionResult<TaskDetail>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { taskId } = parseInput(taskIdSchema, input);
    const { task, project, role } = await getTaskAccess(taskId, user.id);

    const [members, modules, comments, timeLogs, activity, attachments] = await Promise.all([
      getMembers(project.id),
      listModules(project.id),
      listComments(task.id),
      listTaskTimeLogs(task.id),
      listTaskActivity(task.id),
      listAttachments(task.id),
    ]);

    // One batched user lookup for everyone referenced in the drawer.
    const referenced = new Set<string>([task.creatorId, ...members.map((m) => m.userId)]);
    if (task.assigneeId) referenced.add(task.assigneeId);
    for (const c of comments) referenced.add(c.authorId);
    for (const l of timeLogs) referenced.add(l.userId);
    for (const a of activity) referenced.add(a.actorId);
    const userMap = await getUsers([...referenced]);
    const users: Record<string, PublicUser> = {};
    for (const [id, u] of userMap) users[id] = toPublicUser(u);

    const writable = isWritable(project);
    return {
      task,
      project: { id: project.id, key: project.key, name: project.name, archived: project.archived },
      modules: modules.map((m) => ({ id: m.id, name: m.name })),
      members: members
        .map((m) => {
          const u = users[m.userId];
          return u ? { ...u, role: m.role } : null;
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .sort((a, b) => a.name.localeCompare(b.name)),
      users,
      comments,
      timeLogs,
      activity,
      attachments,
      permissions: {
        edit: writable && canEditTask(role, task, user.id),
        delete: writable && canDeleteTask(role, task, user.id),
        comment: writable && canComment(role, project),
        trackTime: writable && canTrackTime(role),
        assignOthers: writable && atLeast(role, "LEAD"),
        manageComments: writable && atLeast(role, "LEAD"),
      },
      viewerId: user.id,
      uploadsEnabled: isStorageConfigured(),
    };
  });
}
