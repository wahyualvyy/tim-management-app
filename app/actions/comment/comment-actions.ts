"use server";

import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { assertWritable, getTaskAccess } from "@/lib/domain/access";
import { extractMentions, notify } from "@/lib/domain/notify";
import { createComment, deleteComment, getComment, updateComment } from "@/lib/redis/repositories/comment.repository";
import { getMembers } from "@/lib/redis/repositories/project.repository";
import { addWatcher, getWatchers } from "@/lib/redis/repositories/task.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
import { recordActivity } from "@/lib/redis/repositories/activity.repository";
import { canComment, canDeleteComment, canEditComment } from "@/lib/permissions";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { taskHref, taskRef } from "@/lib/utils";
import { commentIdSchema, createCommentSchema, updateCommentSchema } from "@/schemas/comment.schema";
import type { ActionResult } from "@/types/action";

export async function addCommentAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { taskId, body } = parseInput(createCommentSchema, input);
    const { task, project, role } = await getTaskAccess(taskId, user.id);
    assertWritable(project);
    if (!canComment(role, project)) throw new ForbiddenError("You can't comment on this project.");

    await createComment(task.id, user.id, body);
    const [members, watchers] = await Promise.all([getMembers(project.id), getWatchers(task.id)]);
    const memberUsers = [...(await getUsers(members.map((m) => m.userId))).values()];
    const mentioned = extractMentions(body, memberUsers);
    await addWatcher(task.id, user.id);

    const ref = taskRef(project.key, task.number);
    const href = taskHref(project.id, task.id);
    const preview = body.length > 140 ? `${body.slice(0, 140)}…` : body;
    await notify(mentioned, user.id, {
      type: "comment.mention",
      title: `${user.name} mentioned you on ${ref}`,
      body: preview,
      href,
    });
    const mentionedSet = new Set(mentioned);
    await notify(
      watchers.filter((id) => !mentionedSet.has(id)),
      user.id,
      { type: "comment.watched", title: `${user.name} commented on ${ref}`, body: preview, href },
    );
    await recordActivity({
      type: "comment.added",
      projectId: project.id,
      actorId: user.id,
      taskId: task.id,
      subject: task.title,
    });
    revalidateApp();
    return undefined;
  });
}

export async function updateCommentAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { commentId, body } = parseInput(updateCommentSchema, input);
    const comment = await getComment(commentId);
    if (!comment) throw new NotFoundError("Comment not found.");
    const { project } = await getTaskAccess(comment.taskId, user.id);
    assertWritable(project);
    if (!canEditComment(comment, user.id)) throw new ForbiddenError("You can only edit your own comments.");
    await updateComment(commentId, body);
    revalidateApp();
    return undefined;
  });
}

export async function deleteCommentAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { commentId } = parseInput(commentIdSchema, input);
    const comment = await getComment(commentId);
    if (!comment) throw new NotFoundError("Comment not found.");
    const { project, role } = await getTaskAccess(comment.taskId, user.id);
    assertWritable(project);
    if (!canDeleteComment(role, comment, user.id)) throw new ForbiddenError();
    await deleteComment(comment);
    revalidateApp();
    return undefined;
  });
}
