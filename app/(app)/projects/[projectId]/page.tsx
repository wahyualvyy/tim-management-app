import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadProjectPage } from "@/lib/domain/project-page";
import { createTaskContext, loadProjectStructure } from "@/lib/domain/project-data";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { listProjectTasks } from "@/lib/redis/repositories/task.repository";
import { listProjectActivity } from "@/lib/redis/repositories/activity.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
import { formatCalendarDate, formatDuration, todayIn } from "@/lib/dates";
import { toPublicUser } from "@/types/user";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, Progress, Stat } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { TaskList } from "@/components/task/task-row";
import { CreateTaskButton } from "@/components/task/create-task-dialog";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project, role } = await loadProjectPage(projectId);
  const now = requestTime();
  const today = todayIn(user.timezone, now);

  const [tasks, { modules, members }, activity] = await Promise.all([
    listProjectTasks(project.id),
    loadProjectStructure(project.id),
    listProjectActivity(project.id, 0, 8),
  ]);

  const done = tasks.filter((t) => t.status === "DONE").length;
  const open = tasks.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const tracked = tasks.reduce((sum, t) => sum + t.trackedSeconds, 0);
  const pct = tasks.length > 0 ? (done / tasks.length) * 100 : 0;
  const activeAssignees = new Set(open.map((t) => t.assigneeId).filter(Boolean)).size;

  const attention = [...overdue, ...open.filter((t) => t.dueDate && t.dueDate >= today && !overdue.includes(t))]
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);
  const [attentionItems, actors] = await Promise.all([
    toTaskItems(attention, [project]),
    getUsers(activity.items.map((a) => a.actorId)),
  ]);
  const actorMap = new Map([...actors].map(([id, u]) => [id, toPublicUser(u)]));
  const ctx = createTaskContext(project, role, user.id, modules, members);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Progress" value={`${Math.round(pct)}%`} hint={`${done} of ${tasks.length} tasks`} />
        <Stat label="Open tasks" value={open.length} hint={`${modules.length} modules`} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "danger" : undefined} />
        <Stat label="Members" value={members.length} hint={`${activeAssignees} with open work`} />
        <Stat label="Tracked" value={formatDuration(tracked)} hint="all time" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {project.description || project.targetDate || project.startDate ? (
            <Card className="px-4 py-3">
              {project.description ? (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{project.description}</p>
              ) : null}
              {project.startDate || project.targetDate ? (
                <p className="mt-2 text-xs text-muted">
                  {project.startDate ? `Started ${formatCalendarDate(project.startDate, { year: "numeric" })}` : ""}
                  {project.startDate && project.targetDate ? " · " : ""}
                  {project.targetDate ? `Target ${formatCalendarDate(project.targetDate, { year: "numeric" })}` : ""}
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Modules"
              action={
                <Link href={`/projects/${project.id}/modules`} className={buttonClasses("ghost", "sm")}>
                  Manage <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {modules.map((m) => {
                const mp = m.stats.total > 0 ? (m.stats.done / m.stats.total) * 100 : 0;
                return (
                  <li key={m.id}>
                    <Link
                      href={`/projects/${project.id}/modules#module-${m.id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 hover:bg-hover sm:grid-cols-[minmax(0,1fr)_160px_64px]"
                    >
                      <span className="truncate text-[13px] font-medium">{m.name}</span>
                      <Progress value={mp} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-1 sm:col-start-2" label={`${m.name} progress`} />
                      <span className="tabular text-right text-xs text-muted sm:col-start-3 sm:row-start-1">
                        {m.stats.done}/{m.stats.total}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Needs attention"
              description="Overdue and upcoming deadlines"
              action={ctx ? <CreateTaskButton context={ctx} variant="ghost" /> : null}
            />
            <TaskList tasks={attentionItems} today={today} empty="No upcoming deadlines." />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Team"
              action={
                <Link href={`/projects/${project.id}/members`} className={buttonClasses("ghost", "sm")}>
                  View
                </Link>
              }
            />
            <ul className="space-y-2.5 px-4 py-3">
              {members.slice(0, 8).map((m) => (
                <li key={m.id} className="flex items-center gap-2.5">
                  <Avatar name={m.name} src={m.avatar} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{m.name}</span>
                  <span className="text-[11px] text-subtle">{m.role.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader
              title="Recent activity"
              action={
                <Link href={`/projects/${project.id}/activity`} className={buttonClasses("ghost", "sm")}>
                  All
                </Link>
              }
            />
            <ActivityFeed items={activity.items} users={actorMap} now={now} compact />
          </Card>
        </div>
      </div>
    </div>
  );
}
