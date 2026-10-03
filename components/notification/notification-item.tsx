"use client";

import { useRouter } from "next/navigation";
import { ArrowRightLeft, AtSign, CalendarClock, CheckCheck, CheckCircle2, Eye, MessageSquare, UserPlus, type LucideIcon } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notification/notification-actions";
import { useAction } from "@/components/hooks/use-action";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/dates";
import { cn, safeRedirectPath } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/notification";

const ICONS: Record<NotificationType, LucideIcon> = {
  "project.invited": UserPlus,
  "task.assigned": UserPlus,
  "task.status_changed": ArrowRightLeft,
  "task.review_requested": Eye,
  "task.completed": CheckCircle2,
  "task.deadline": CalendarClock,
  "comment.mention": AtSign,
  "comment.added": MessageSquare,
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
      <div className={cn("group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-hover", !n.read && "bg-accent-soft/50")}>
        <button
          type="button"
          onClick={() => {
            if (!n.read) void markRead.run({ notificationId: n.id });
            router.push(safeRedirectPath(n.href, "/notifications"));
          }}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="relative mt-0.5 shrink-0">
            {actor ? (
              <Avatar name={actor.name} src={actor.avatar} size="md" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            )}
            {actor ? (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-muted ring-1 ring-border">
                <Icon className="h-2.5 w-2.5" aria-hidden />
              </span>
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block text-[13px]", !n.read && "font-medium")}>{n.title}</span>
            {n.body ? <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{n.body}</span> : null}
            <span className="mt-1 block text-[11px] text-subtle">{formatRelative(n.createdAt, now)}</span>
          </span>
        </button>
        {!n.read ? (
          <button
            type="button"
            onClick={() => void markRead.run({ notificationId: n.id })}
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            aria-label="Tandai dibaca"
            title="Tandai dibaca"
          >
            <span className="h-2 w-2 rounded-full bg-accent" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function MarkAllReadButton() {
  const { run, pending } = useAction(markAllNotificationsReadAction, { successMessage: "Semua notifikasi ditandai dibaca." });
  return (
    <Button variant="outline" loading={pending} onClick={() => void run(undefined)}>
      <CheckCheck className="h-4 w-4" aria-hidden />
      Tandai semua dibaca
    </Button>
  );
}
