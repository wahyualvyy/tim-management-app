import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { countUserProjects, getProjectSummaries, getProjects, listUserProjectIds } from "@/lib/redis/projects";
import { getUserTaskCounts, listUserDueBetween } from "@/lib/redis/tasks";
import { listUserTimeLogsSince } from "@/lib/redis/timeLogs";
import { listRecentActivities } from "@/lib/redis/activities";
import { getUsers } from "@/lib/redis/users";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { addDays, formatCalendarDate, formatDuration, todayIn, zonedMidnight } from "@/lib/dates";
import { toPublicUser } from "@/types/user";
import { Card, CardHeader, EmptyState, PageHeader, ProgressSummary, Stat } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { ProjectIcon } from "@/components/project/project-icon";
import { NewProjectButton } from "@/components/project/new-project-button";
import { TaskList } from "@/components/task/task-row";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { WeekChart } from "@/components/activity/week-chart";

export const metadata: Metadata = { title: "Dasbor" };

/** Projects whose activity and progress the dashboard reads (most recently joined). */
const DASHBOARD_PROJECTS = 50;

function greeting(hour: number): string {
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = requestTime();
  const today = todayIn(user.timezone, now);
  const weekAgo = addDays(today, -6);

  const weekStart = zonedMidnight(weekAgo, user.timezone);

  const projectIds = await listUserProjectIds(user.id, 0, DASHBOARD_PROJECTS);
  const [projects, summaries, projectTotal, counts, dueSoon, logs, activity] = await Promise.all([
    getProjects(projectIds),
    getProjectSummaries(projectIds, 0),
    countUserProjects(user.id),
    getUserTaskCounts(user.id, today, weekStart),
    listUserDueBetween(user.id, null, addDays(today, 14), 40),
    listUserTimeLogsSince(user.id, weekStart),
    listRecentActivities(projectIds, 0, 8),
  ]);
  const firstName = user.name.split(" ")[0] ?? user.name;

  if (projects.length === 0) {
    return (
      <>
        <PageHeader title={`Halo, ${firstName}`} description="Mari mulai dengan proyek pertama Anda." />
        <Card>
          <EmptyState
            icon={<FolderPlus className="h-5 w-5" />}
            title="Belum ada proyek"
            description="Mulai dengan membuat proyek pertama Anda, lalu susun modul, sub modul, dan tugasnya."
            action={<NewProjectButton label="Tambah proyek" />}
          />
        </Card>
      </>
    );
  }

  const active = projects.filter((p) => p.status !== "ARCHIVED" && p.status !== "COMPLETED");
  // Assigned open tasks with a due date, earliest first (bounded by the index query).
  const focus = dueSoon.filter((t) => t.dueDate !== null && t.dueDate <= today).slice(0, 8);
  const upcoming = dueSoon.filter((t) => t.dueDate !== null && t.dueDate > today).slice(0, 6);

  // Seconds per local day for the last 7 days (sessions count on the day they ended).
  const perDay = new Map<string, number>();
  for (const log of logs) {
    const day = todayIn(user.timezone, log.endedAt);
    perDay.set(day, (perDay.get(day) ?? 0) + log.durationSeconds);
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekAgo, i);
    return {
      date,
      label: formatCalendarDate(date, { weekday: "short", month: undefined, day: undefined }),
      seconds: perDay.get(date) ?? 0,
      isToday: date === today,
    };
  });

  const [focusItems, upcomingItems, actors] = await Promise.all([
    toTaskItems(focus, { projects }),
    toTaskItems(upcoming, { projects }),
    getUsers(activity.items.map((a) => a.actorId)),
  ]);
  const actorMap = new Map([...actors].map(([id, u]) => [id, toPublicUser(u)] as const));
  const projectNames = new Map(projects.map((p) => [p.id, p.name] as const));
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: user.timezone }).format(now));

  return (
    <>
      <PageHeader title={`${greeting(hour)}, ${firstName}`} description="Ringkasan pekerjaan Anda hari ini." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Proyek" value={projectTotal} hint={projectTotal > projects.length ? undefined : `${active.length} aktif`} />
        <Stat label="Tugas saya" value={counts.open} hint="belum selesai" />
        <Stat label="Terlambat" value={counts.overdue} tone={counts.overdue > 0 ? "danger" : undefined} hint="melewati tenggat" />
        <Stat label="Selesai" value={counts.doneSince} tone={counts.doneSince > 0 ? "success" : undefined} hint="7 hari terakhir" />
        <Stat label="Waktu kerja hari ini" value={formatDuration(perDay.get(today) ?? 0)} hint="dari timer & catatan" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Fokus Anda"
              description="Tugas Anda yang terlambat atau jatuh tempo hari ini"
              action={
                <Link href="/my-tasks" className={buttonClasses("ghost", "sm")}>
                  Semua tugas <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <TaskList tasks={focusItems} today={today} showProject empty="Tidak ada yang mendesak. Kerja bagus!" />
          </Card>

          <Card>
            <CardHeader title="Tenggat terdekat" description="Tugas Anda dalam 14 hari ke depan" />
            <TaskList tasks={upcomingItems} today={today} showProject empty="Tidak ada tenggat dalam dua minggu ke depan." />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Waktu kerja" description={`7 hari terakhir · ${formatDuration(days.reduce((s, d) => s + d.seconds, 0))}`} />
            <div className="px-4 py-4">
              <WeekChart days={days} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Progres proyek"
              action={
                <Link href="/projects" className={buttonClasses("ghost", "sm")}>
                  Lihat semua
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {active.slice(0, 6).map((p) => {
                const s = summaries.get(p.id);
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover">
                      <ProjectIcon icon={p.icon} color={p.color} />
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 truncate text-[13px] font-medium">{p.name}</p>
                        <ProgressSummary done={s?.stats.done ?? 0} total={s?.stats.total ?? 0} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Aktivitas terbaru"
              action={
                <Link href="/activity" className={buttonClasses("ghost", "sm")}>
                  Semua
                </Link>
              }
            />
            <ActivityFeed items={activity.items} users={actorMap} now={now} projectNames={projectNames} compact />
          </Card>
        </div>
      </div>
    </>
  );
}
