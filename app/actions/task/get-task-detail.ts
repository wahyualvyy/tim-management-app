"use server";

import { z } from "zod";
import { requireAuth, requireTaskAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { listProjectStructure } from "@/lib/redis/modules";
import { listAttachments } from "@/lib/redis/attachments";
import { listComments } from "@/lib/redis/comments";
import { getActiveTimer, getRunningUsers, getTaskTime, listTaskTimeLogs } from "@/lib/redis/timeLogs";
import { listTaskActivities } from "@/lib/redis/activities";
import { getUsers } from "@/lib/redis/users";
import { structureOptions } from "@/lib/domain/project-data";
import { uploadMode } from "@/lib/storage";
import { atLeast, canComment, canDeleteTask, canManageTask, canTrackTime, isWritable } from "@/lib/permissions";
import { taskRef } from "@/lib/utils";
import { idSchema } from "@/schemas/common";
import { taskIdSchema } from "@/schemas/task.schema";
import { toPublicUser, type PublicUser } from "@/types/user";
import type { ActionResult } from "@/types/action";
import type { Comment } from "@/types/task";
import type { TimeLog } from "@/types/timer";
import { COMMENT_PAGE, TIME_LOG_PAGE, type TaskDetail } from "@/types/task-detail";

async function publicUsers(ids: Iterable<string>): Promise<Record<string, PublicUser>> {
  const map = await getUsers([...new Set(ids)]);
  const out: Record<string, PublicUser> = {};
  for (const [id, u] of map) out[id] = toPublicUser(u);
  return out;
}

export async function getTaskDetailAction(input: unknown): Promise<ActionResult<TaskDetail>> {
  return runAction("getTaskDetail", async () => {
    const user = await requireAuth();
    const { taskId } = parseInput(taskIdSchema, input);
    const { task, project, role } = await requireTaskAccess(user, taskId);

    const [structure, commentPage, logPage, time, runningMap, activity, attachments] = await Promise.all([
      listProjectStructure(project.id),
      listComments(task.id, COMMENT_PAGE),
      listTaskTimeLogs(task.id, 0, TIME_LOG_PAGE),
      getTaskTime(task.id),
      getRunningUsers([task.id]),
      listTaskActivities(task.id, 30),
      listAttachments(task.id),
    ]);
    const timers = await Promise.all((runningMap.get(task.id) ?? []).map((id) => getActiveTimer(id)));

    // One batched lookup for exactly the people this payload references.
    const users = await publicUsers([
      task.creatorId,
      ...task.assigneeIds,
      ...commentPage.comments.map((c) => c.authorId),
      ...logPage.logs.map((l) => l.userId),
      ...activity.map((a) => a.actorId),
      ...Object.keys(time.byUser),
      ...attachments.map((a) => a.uploadedBy),
    ]);

    const writable = isWritable(project);
    return {
      task,
      ref: taskRef(project.key, task.number),
      project: { id: project.id, key: project.key, name: project.name, archived: !writable },
      structure: structureOptions(structure),
      users,
      comments: commentPage.comments,
      hasOlderComments: commentPage.hasOlder,
      timeLogs: logPage.logs,
      hasMoreTimeLogs: logPage.hasMore,
      time,
      running: timers.flatMap((t) => (t && t.taskId === task.id ? [{ userId: t.userId, startedAt: t.startedAt }] : [])),
      activity,
      attachments: attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        isProof: a.isProof,
        uploadedBy: a.uploadedBy,
        createdAt: a.createdAt,
        href: `/api/attachments/${task.id}/${a.id}`,
      })),
      permissions: {
        edit: writable && canManageTask(role, task, user.id),
        delete: writable && canDeleteTask(role, task, user.id),
        comment: writable && canComment(role, project),
        trackTime: writable && canTrackTime(role),
        assignOthers: writable && atLeast(role, "LEAD"),
        moderate: writable && atLeast(role, "LEAD"),
      },
      viewerId: user.id,
      uploadMode: uploadMode(),
    };
  });
}

const olderCommentsSchema = z.object({ taskId: idSchema, before: z.number().int().positive() });

/** Older comments for the drawer, one page at a time. */
export async function loadOlderCommentsAction(
  input: unknown,
): Promise<ActionResult<{ comments: Comment[]; hasOlder: boolean; users: Record<string, PublicUser> }>> {
  return runAction("loadOlderComments", async () => {
    const user = await requireAuth();
    const { taskId, before } = parseInput(olderCommentsSchema, input);
    await requireTaskAccess(user, taskId);
    const page = await listComments(taskId, COMMENT_PAGE, before);
    return { ...page, users: await publicUsers(page.comments.map((c) => c.authorId)) };
  });
}

const moreLogsSchema = z.object({ taskId: idSchema, offset: z.number().int().min(0).max(100_000) });

export async function loadMoreTimeLogsAction(
  input: unknown,
): Promise<ActionResult<{ logs: TimeLog[]; hasMore: boolean; users: Record<string, PublicUser> }>> {
  return runAction("loadMoreTimeLogs", async () => {
    const user = await requireAuth();
    const { taskId, offset } = parseInput(moreLogsSchema, input);
    await requireTaskAccess(user, taskId);
    const page = await listTaskTimeLogs(taskId, offset, TIME_LOG_PAGE);
    return { ...page, users: await publicUsers(page.logs.map((l) => l.userId)) };
  });
}
