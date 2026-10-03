"use server";

import { assertWritable, requireAuth, requireTaskAccess } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { notify, resolveMentions } from "@/lib/domain/notify";
import { createComment, deleteComment, getComment, updateComment } from "@/lib/redis/comments";
import { addWatcher, getWatchers } from "@/lib/redis/tasks";
import { recordActivity } from "@/lib/redis/activities";
import { canComment, canDeleteComment, canEditComment } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { revalidateApp } from "@/lib/revalidate";
import { taskHref, taskRef } from "@/lib/utils";
import { commentIdSchema, createCommentSchema, updateCommentSchema } from "@/schemas/comment.schema";
import type { ActionResult } from "@/types/action";

export async function addCommentAction(input: unknown): Promise<ActionResult> {
  return runAction("addComment", async () => {
    const user = await requireAuth();
    const { taskId, body } = parseInput(createCommentSchema, input);
    const { task, project, role } = await requireTaskAccess(user, taskId);
    assertWritable(project);
    if (!canComment(role, project)) throw new ForbiddenError("Anda tidak dapat berkomentar di proyek ini.");
    await enforceRateLimit("comment", user.id);

    await createComment(task.id, user.id, body);
    const [mentioned, watchers] = await Promise.all([resolveMentions(project.id, body), getWatchers(task.id)]);
    await addWatcher(task.id, user.id);

    const ref = taskRef(project.key, task.number);
    const href = taskHref(project.id, task.id);
    const preview = body.length > 140 ? `${body.slice(0, 140)}…` : body;
    await notify(mentioned, user.id, { type: "comment.mention", title: `${user.name} menyebut Anda di ${ref}`, body: preview, href });
    const mentionedSet = new Set(mentioned);
    await notify(
      watchers.filter((id) => !mentionedSet.has(id)),
      user.id,
      { type: "comment.added", title: `${user.name} berkomentar di ${ref}`, body: preview, href },
    );
    await recordActivity({ type: "comment.added", projectId: project.id, actorId: user.id, taskId: task.id, subject: task.title });
    revalidateApp();
    return undefined;
  });
}

export async function updateCommentAction(input: unknown): Promise<ActionResult> {
  return runAction("updateComment", async () => {
    const user = await requireAuth();
    const { commentId, body } = parseInput(updateCommentSchema, input);
    const comment = await getComment(commentId);
    if (!comment) throw new NotFoundError("Komentar tidak ditemukan.");
    const { project } = await requireTaskAccess(user, comment.taskId);
    assertWritable(project);
    if (!canEditComment(comment, user.id)) throw new ForbiddenError("Anda hanya dapat mengubah komentar sendiri.");
    await updateComment(commentId, body);
    revalidateApp();
    return undefined;
  });
}

export async function deleteCommentAction(input: unknown): Promise<ActionResult> {
  return runAction("deleteComment", async () => {
    const user = await requireAuth();
    const { commentId } = parseInput(commentIdSchema, input);
    const comment = await getComment(commentId);
    if (!comment) throw new NotFoundError("Komentar tidak ditemukan.");
    const { project, role } = await requireTaskAccess(user, comment.taskId);
    assertWritable(project);
    if (!canDeleteComment(role, comment, user.id)) throw new ForbiddenError();
    await deleteComment(comment);
    revalidateApp();
    return undefined;
  });
}
