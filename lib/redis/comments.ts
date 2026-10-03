import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray, bool, num, str, toHash, toRawHash, type RawHash } from "./serialize";
import { newId } from "@/lib/utils";
import type { Comment } from "@/types/task";

function parseComment(hash: RawHash): Comment {
  return {
    id: str(hash, "id"),
    taskId: str(hash, "taskId"),
    authorId: str(hash, "authorId"),
    body: str(hash, "body"),
    createdAt: num(hash, "createdAt"),
    updatedAt: num(hash, "updatedAt"),
    edited: bool(hash, "edited"),
  };
}

export async function getComment(commentId: string): Promise<Comment | null> {
  const hash = toRawHash(await redis().hgetall(keys.comment(commentId)));
  return hash ? parseComment(hash) : null;
}

/**
 * A page of comments, newest `limit` before `before` (epoch ms, exclusive),
 * returned oldest first for display. `hasOlder` tells whether to offer more.
 */
export async function listComments(taskId: string, limit: number, before?: number): Promise<{ comments: Comment[]; hasOlder: boolean }> {
  const r = redis();
  const ids = asStringArray(
    await r.zrange(keys.taskComments(taskId), before ? `(${before}` : "+inf", "-inf", { byScore: true, rev: true, offset: 0, count: limit + 1 }),
  );
  const page = ids.slice(0, limit);
  if (page.length === 0) return { comments: [], hasOlder: false };
  const pipe = r.pipeline();
  for (const id of page) pipe.hgetall(keys.comment(id));
  const results = (await pipe.exec()) as unknown[];
  const comments = results.map(toRawHash).filter((h): h is RawHash => h !== null).map(parseComment).reverse();
  return { comments, hasOlder: ids.length > limit };
}

export async function createComment(taskId: string, authorId: string, body: string): Promise<Comment> {
  const now = Date.now();
  const comment: Comment = { id: newId(), taskId, authorId, body, createdAt: now, updatedAt: now, edited: false };
  const tx = redis().multi();
  tx.hset(keys.comment(comment.id), toHash({ ...comment }));
  tx.zadd(keys.taskComments(taskId), { score: now, member: comment.id });
  await tx.exec();
  return comment;
}

export async function updateComment(commentId: string, body: string): Promise<void> {
  await redis().hset(keys.comment(commentId), { body, edited: "1", updatedAt: String(Date.now()) });
}

export async function deleteComment(comment: Comment): Promise<void> {
  const tx = redis().multi();
  tx.zrem(keys.taskComments(comment.taskId), comment.id);
  tx.del(keys.comment(comment.id));
  await tx.exec();
}
