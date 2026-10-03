import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { countUnread, listNotifications } from "@/lib/redis/repositories/notification.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
import { requestTime } from "@/lib/domain/views";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { MarkAllReadButton, NotificationItem } from "@/components/notifications/notification-item";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 30;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const page = parsePage((await searchParams).page);
  const [{ items, hasMore }, unread] = await Promise.all([
    listNotifications(user.id, (page - 1) * PAGE_SIZE, PAGE_SIZE),
    countUnread(user.id),
  ]);
  const actors = await getUsers(items.map((n) => n.actorId).filter((id): id is string => Boolean(id)));
  const now = requestTime();

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up."}
        actions={unread > 0 ? <MarkAllReadButton /> : null}
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-5 w-5" />}
            title="No notifications"
            description="You'll hear about assignments, mentions, reviews and upcoming deadlines here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const actor = n.actorId ? actors.get(n.actorId) : undefined;
              return (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  actor={actor ? { name: actor.name, avatar: actor.avatar } : null}
                  now={now}
                />
              );
            })}
          </ul>
        )}
      </Card>
      <Pagination basePath="/notifications" page={page} hasMore={hasMore} />
    </>
  );
}
