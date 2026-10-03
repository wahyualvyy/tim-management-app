import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProjectSummaries, getProjects, listUserProjectIds } from "@/lib/redis/repositories/project.repository";
import { listAssignedTasks, listScheduledTasks } from "@/lib/redis/repositories/task.repository";
import { listUserTimeLogsSince } from "@/lib/redis/repositories/timer.repository";
import { listRecentActivity } from "@/lib/redis/repositories/activity.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { addDays, formatDuration, startOfWeek, todayIn, zonedMidnight } from "@/lib/dates";
import { toPublicUser } from "@/types/user";
import { Card, CardHeader, EmptyState, PageHeader, Progress, Stat } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { ProjectIcon } from "@/components/project/project-icon";
import { NewProjectButton } from "@/components/project/new-project-button";
import { TaskList } from "@/components/task/task-row";
import { ActivityFeed } from "@/components/activity/activity-feed";

export const metadata: Metadata = { title: "Home" };

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = requestTime();
  const today = todayIn(user.timezone, now);
  const weekStart = zonedMidnight(startOfWeek(today), user.timezone);

  const projectIds = await listUserProjectIds(user.id);
  const [projects, summaries, assigned, upcomingRaw, weekLogs, activity] = await Promise.all([
    getProjects(projectIds),
    getProjectSummaries(projectIds, user.id),
    listAssignedTasks(user.id),
    listScheduledTasks(projectIds, today, addDays(today, 14)),
    listUserTimeLogsSince(user.id, weekStart),
    listRecentActivity(projectIds, 8),
  ]);

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} />
        <Card>
          <EmptyState
            icon={<FolderPlus className="h-5 w-5" />}
            title="Create your first project"
            description="Organize work into modules and tasks, invite your team and track time as you go."
            action={<NewProjectButton />}
          />
        </Card>
      </>
    );
  }

  const open = assigned.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const inProgress = open.filter((t) => t.status === "IN_PROGRESS" || t.status === "REVIEW");
  const focus = open
    .filter((t) => (t.dueDate !== null && t.dueDate <= today) || t.status === "IN_PROGRESS")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 8);
  const upcoming = upcomingRaw
    .filter((t) => t.status !== "DONE" && t.dueDate !== null && t.dueDate >= today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);
  const trackedWeek = weekLogs.reduce((sum, l) => sum + l.durationSeconds, 0);

  const [focusItems, upcomingItems, actors] = await Promise.all([
    toTaskItems(focus, projects),
    toTaskItems(upcoming, projects),
    getUsers(activity.map((a) => a.actorId)),
  ]);
  const actorMap = new Map([...actors].map(([id, u]) => [id, toPublicUser(u)]));
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: user.timezone }).format(now),
  );

  const activeProjects = projects.filter((p) => !p.archived).slice(0, 6);

  return (
    <>
      <PageHeader
        title={`${greeting(hour)}, ${user.name.split(" ")[0]}`}
        description="Here's what needs your attention."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Assigned to you" value={open.length} hint="open tasks" />
        <Stat label="In progress" value={inProgress.length} hint="including review" />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length > 0 ? "danger" : undefined} hint="past due date" />
        <Stat label="Tracked this week" value={formatDuration(trackedWeek)} hint="since Monday" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Your focus"
              description="Overdue, due today and in progress"
              action={
                <Link href="/my-tasks" className={buttonClasses("ghost", "sm")}>
                  All my tasks <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <TaskList tasks={focusItems} today={today} showProject empty="You're all caught up for today." />
          </Card>

          <Card>
            <CardHeader title="Upcoming deadlines" description="Next 14 days across your projects" />
            <TaskList tasks={upcomingItems} today={today} showProject empty="No deadlines in the next two weeks." />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Projects"
              action={
                <Link href="/projects" className={buttonClasses("ghost", "sm")}>
                  View all
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {activeProjects.map((p) => {
                const s = summaries.get(p.id);
                const pct = s && s.stats.total > 0 ? (s.stats.done / s.stats.total) * 100 : 0;
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover">
                      <ProjectIcon icon={p.icon} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{p.name}</p>
                        <Progress value={pct} className="mt-1.5" label={`${p.name} progress`} />
                      </div>
                      <span className="tabular w-9 text-right text-xs text-muted">{Math.round(pct)}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            <ActivityFeed items={activity} users={actorMap} now={now} projectNames={projectNames} compact />
          </Card>
        </div>
      </div>
    </>
  );
}
