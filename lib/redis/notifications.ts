import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray, num, oneOf, str, strOrNull, toHash, toRawHash, type RawHash } from "./serialize";
import { newId } from "@/lib/utils";
import { NOTIFICATION_TYPES, type Notification, type NotificationType } from "@/types/notification";

/** Older notifications beyond this are removed when new ones arrive. */
const KEEP_PER_USER = 200;

function parseNotification(hash: RawHash, unread: Set<string>): Notification {
  const id = str(hash, "id");
  return {
    id,
    userId: str(hash, "userId"),
    type: oneOf<NotificationType>(hash.type, NOTIFICATION_TYPES, "task.assigned"),
    actorId: strOrNull(hash, "actorId"),
    title: str(hash, "title"),
    body: str(hash, "body"),
    href: str(hash, "href") || "/notifications",
    read: !unread.has(id),
    createdAt: num(hash, "createdAt"),
  };
}

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  actorId: string | null;
  title: string;
  body: string;
  href: string;
}

export async function createNotifications(inputs: readonly NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();
  const pipe = redis().pipeline();
  const users = new Set<string>();
  for (const input of inputs) {
    const id = newId();
    users.add(input.userId);
    pipe.hset(
      keys.notification(id),
      toHash({
        id,
        userId: input.userId,
        type: input.type,
        actorId: input.actorId,
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 300),
        href: input.href,
        createdAt: now,
      }),
    );
    pipe.zadd(keys.userNotifications(input.userId), { score: now, member: id });
    pipe.sadd(keys.userUnread(input.userId), id);
  }
  await pipe.exec();
  await Promise.all([...users].map((userId) => trimNotifications(userId)));
}

async function trimNotifications(userId: string): Promise<void> {
  const r = redis();
  const count = await r.zcard(keys.userNotifications(userId));
  if (count <= KEEP_PER_USER) return;
  const stale = asStringArray(await r.zrange(keys.userNotifications(userId), 0, count - KEEP_PER_USER - 1));
  if (stale.length === 0) return;
  const pipe = r.pipeline();
  pipe.zrem(keys.userNotifications(userId), ...stale);
  pipe.srem(keys.userUnread(userId), ...stale);
  for (const id of stale) pipe.del(keys.notification(id));
  await pipe.exec();
}

export async function listNotifications(
  userId: string,
  offset: number,
  limit: number,
): Promise<{ items: Notification[]; hasMore: boolean }> {
  const r = redis();
  const ids = asStringArray(
    await r.zrange(keys.userNotifications(userId), offset, offset + limit, { rev: true }),
  );
  if (ids.length === 0) return { items: [], hasMore: false };
  const page = ids.slice(0, limit);
  const pipe = r.pipeline();
  for (const id of page) pipe.hgetall(keys.notification(id));
  pipe.smembers(keys.userUnread(userId));
  const results = (await pipe.exec()) as unknown[];
  const unread = new Set(asStringArray(results[results.length - 1]));
  const items: Notification[] = [];
  for (let i = 0; i < page.length; i++) {
    const hash = toRawHash(results[i]);
    if (hash) items.push(parseNotification(hash, unread));
  }
  return { items, hasMore: ids.length > limit };
}

export async function countUnread(userId: string): Promise<number> {
  return redis().scard(keys.userUnread(userId));
}

/** Marks one notification read. Only touches the caller's own unread set. */
export async function markRead(userId: string, notificationId: string): Promise<void> {
  await redis().srem(keys.userUnread(userId), notificationId);
}

export async function markAllRead(userId: string): Promise<void> {
  await redis().del(keys.userUnread(userId));
}
