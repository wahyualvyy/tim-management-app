"use client";

import { useRouter } from "next/navigation";
import { AtSign, CalendarClock, CheckCheck, Eye, MessageSquare, UserPlus, type LucideIcon } from "lucide-react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notification/notification-actions";
import { useAction } from "@/components/hooks/use-action";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/dates";
import { cn, safeRedirectPath } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/notification";

const ICONS: Record<NotificationType, LucideIcon> = {
  "task.assigned": UserPlus,
  "comment.mention": AtSign,
  "comment.watched": MessageSquare,
  "task.review": Eye,
  "task.deadline": CalendarClock,
  "project.invited": UserPlus,
};

export function NotificationItem({
  notification: n,
  actor,
  now,
}: {
  notification: Notification;
  actor: { name: string; avatar: string | null } | null;
  now: number;
}) {
  const router = useRouter();
  const markRead = useAction(markNotificationReadAction);
  const Icon = ICONS[n.type];

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (!n.read) void markRead.run({ notificationId: n.id });
          router.push(safeRedirectPath(n.href, "/notifications"));
        }}
        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-hover", !n.read && "bg-accent-soft/40")}
      >
        <span className="relative mt-0.5">
          {actor ? (
            <Avatar name={actor.name} src={actor.avatar} size="md" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-muted">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          )}
          {actor ? (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface text-muted">
              <Icon className="h-2.5 w-2.5" aria-hidden />
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[13px]", !n.read && "font-medium")}>{n.title}</span>
          {n.body ? <span className="mt-0.5 block line-clamp-2 text-[13px] text-muted">{n.body}</span> : null}
          <span className="mt-1 block text-[11px] text-subtle">{formatRelative(n.createdAt, now)}</span>
        </span>
        {!n.read ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" /> : null}
      </button>
    </li>
  );
}

export function MarkAllReadButton() {
  const { run, pending } = useAction(markAllNotificationsReadAction, { successMessage: "All caught up" });
  return (
    <Button variant="outline" loading={pending} onClick={() => void run(undefined)}>
      <CheckCheck className="h-4 w-4" aria-hidden />
      Mark all read
    </Button>
  );
}
