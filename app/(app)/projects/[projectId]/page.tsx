import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createTaskContext, loadMemberPreview, loadProjectPage, loadStructure } from "@/lib/domain/project-data";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { getProjectSummaries, getProjectTime } from "@/lib/redis/projects";
import { countOverdue, listColumnPage, listOpenByDue } from "@/lib/redis/tasks";
import { listProjectActivities } from "@/lib/redis/activities";
import { getUsers } from "@/lib/redis/users";
import { formatCalendarDate, formatDuration, todayIn } from "@/lib/dates";
import { ROLE_LABEL } from "@/lib/labels";
import { toPublicUser } from "@/types/user";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, ProgressSummary, Stat } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { TaskList } from "@/components/task/task-row";
import { CreateTaskButton } from "@/components/task/create-task-dialog";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { user, project, role } = await loadProjectPage(projectId);
  const now = requestTime();
  const today = todayIn(user.timezone, now);

  // Counts come from the stats counters and indexes; only the few tasks shown are loaded.
  const [summaries, overdueCount, blockedPage, dueSoon, structure, preview, activity, time] = await Promise.all([
    getProjectSummaries([project.id], 0),
    countOverdue(project.id, today),
    listColumnPage(project.id, "BLOCKED", 0, 5),
    listOpenByDue(project.id, 7),
    loadStructure(project.id),
    loadMemberPreview(project.id),
    listProjectActivities(project.id, 0, 8),
    getProjectTime(project.id),
  ]);
  const summary = summaries.get(project.id);
  const total = summary?.stats.total ?? 0;
  const done = summary?.stats.done ?? 0;
  const openCount = Math.max(0, total - done);
  const blockedCount = summary?.statusCounts.BLOCKED ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const attention = [...blockedPage.tasks, ...dueSoon.filter((t) => t.status !== "BLOCKED")].slice(0, 7);
  const perUser = Object.entries(time.byUser).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const [attentionItems, actors] = await Promise.all([
    toTaskItems(attention, { projects: [project], structure }),
    getUsers([...activity.items.map((a) => a.actorId), ...perUser.map(([id]) => id)]),
  ]);
  const actorMap = new Map([...actors].map(([id, u]) => [id, toPublicUser(u)] as const));
  const ctx = createTaskContext(project, role, user, structure);
  const maxModuleTime = Math.max(...structure.map((m) => m.trackedSeconds), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Progres" value={`${pct}%`} hint={`${done} dari ${total} tugas`} />
        <Stat label="Tugas terbuka" value={openCount} hint={`${structure.length} modul`} />
        <Stat label="Terlambat" value={overdueCount} tone={overdueCount ? "danger" : undefined} />
        <Stat label="Terhambat" value={blockedCount} tone={blockedCount ? "danger" : undefined} />
        <Stat label="Waktu tercatat" value={formatDuration(time.totalSeconds)} hint="seluruh proyek" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {project.description || project.startDate || project.dueDate ? (
            <section>
              {project.description ? <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{project.description}</p> : null}
              {project.startDate || project.dueDate ? (
                <p className="mt-2 text-xs text-muted">
                  {project.startDate ? `Mulai ${formatCalendarDate(project.startDate, { year: "numeric" })}` : ""}
                  {project.startDate && project.dueDate ? " · " : ""}
                  {project.dueDate ? `Tenggat ${formatCalendarDate(project.dueDate, { year: "numeric" })}` : ""}
                </p>
              ) : null}
            </section>
          ) : null}

          <Card>
            <CardHeader
              title="Modul"
              action={
                <Link href={`/projects/${project.id}/structure`} className={buttonClasses("ghost", "sm")}>
                  Kelola <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {structure.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/projects/${project.id}/structure#node-${m.id}`}
                    className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-hover sm:grid-cols-[minmax(0,1fr)_180px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{m.name}</span>
                      <span className="block text-[11px] text-subtle">
                        {m.subModules.length} sub modul
                        {m.trackedSeconds > 0 ? ` · ${formatDuration(m.trackedSeconds)}` : ""}
                      </span>
                    </span>
                    <ProgressSummary done={m.stats.done} total={m.stats.total} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Butuh perhatian"
              description="Terhambat dan tenggat terdekat"
              action={ctx ? <CreateTaskButton context={ctx} variant="ghost" /> : null}
            />
            <TaskList tasks={attentionItems} today={today} empty="Tidak ada tugas yang butuh perhatian." />
          </Card>

          <Card>
            <CardHeader title="Ringkasan waktu" description={`Total ${formatDuration(time.totalSeconds)}`} />
            <div className="grid gap-6 px-4 py-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Per modul</p>
                <ul className="space-y-2">
                  {structure.map((m) => (
                    <li key={m.id} className="text-[13px]">
                      <div className="mb-1 flex justify-between gap-2">
                        <span className="truncate">{m.name}</span>
                        <span className="tabular text-muted">{formatDuration(m.trackedSeconds)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent/70" style={{ width: `${(m.trackedSeconds / maxModuleTime) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Per anggota</p>
                {perUser.length === 0 ? (
                  <p className="text-[13px] text-subtle">Belum ada waktu tercatat.</p>
                ) : (
                  <ul className="space-y-2">
                    {perUser.map(([id, seconds]) => {
                      const u = actorMap.get(id);
                      return (
                        <li key={id} className="flex items-center gap-2 text-[13px]">
                          <Avatar name={u?.name ?? "?"} src={u?.avatar} size="xs" />
                          <span className="min-w-0 flex-1 truncate">{u?.name ?? "Mantan anggota"}</span>
                          <span className="tabular font-medium">{formatDuration(seconds)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title={`Tim · ${preview.total}`}
              action={
                <Link href={`/projects/${project.id}/members`} className={buttonClasses("ghost", "sm")}>
                  Lihat
                </Link>
              }
            />
            <ul className="space-y-2.5 px-4 py-3">
              {preview.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5">
                  <Avatar name={m.name} src={m.avatar} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{m.name}</span>
                    {m.jobTitle ? <span className="block truncate text-[11px] text-subtle">{m.jobTitle}</span> : null}
                  </span>
                  <span className="text-[11px] text-subtle">{ROLE_LABEL[m.role]}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader
              title="Aktivitas terbaru"
              action={
                <Link href={`/projects/${project.id}/activity`} className={buttonClasses("ghost", "sm")}>
                  Semua
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
