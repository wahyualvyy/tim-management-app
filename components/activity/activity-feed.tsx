import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { describeActivity } from "@/lib/activity-format";
import { formatRelative } from "@/lib/dates";
import { taskHref } from "@/lib/utils";
import type { Activity } from "@/types/activity";
import type { PublicUser } from "@/types/user";

/** Activity timeline. Server component: no client JavaScript. */
export function ActivityFeed({
  items,
  users,
  now,
  projectNames,
  compact = false,
}: {
  items: Activity[];
  users: Map<string, PublicUser>;
  now: number;
  projectNames?: Map<string, string>;
  compact?: boolean;
}) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-[13px] text-subtle">Belum ada aktivitas.</p>;
  return (
    <ol className={compact ? "divide-y divide-border" : "relative ml-3 space-y-5 border-l border-border py-1 pl-6"}>
      {items.map((a) => {
        const actor = users.get(a.actorId);
        const line = (
          <>
            <span className="font-medium text-fg">{actor?.name ?? "Mantan anggota"}</span> <span className="text-muted">{describeActivity(a)}</span>
          </>
        );
        return (
          <li key={a.id} className={compact ? "flex gap-2.5 px-4 py-2.5" : "relative"}>
            {compact ? (
              <Avatar name={actor?.name ?? "?"} src={actor?.avatar} size="xs" className="mt-0.5" />
            ) : (
              <span className="absolute -left-[35px] top-0">
                <Avatar name={actor?.name ?? "?"} src={actor?.avatar} size="sm" className="ring-4 ring-background" />
              </span>
            )}
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              {a.taskId && a.type !== "task.deleted" ? (
                <Link href={taskHref(a.projectId, a.taskId)} scroll={false} className="hover:underline">
                  {line}
                </Link>
              ) : (
                <p>{line}</p>
              )}
              <p className="mt-0.5 text-[11px] text-subtle">
                {formatRelative(a.createdAt, now)}
                {projectNames?.get(a.projectId) ? ` · ${projectNames.get(a.projectId)}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
