import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProjects, listUserProjectIds } from "@/lib/redis/repositories/project.repository";
import { listScheduledTasks } from "@/lib/redis/repositories/task.repository";
import { requestTime, toTaskItems } from "@/lib/domain/views";
import { addDays, formatCalendarDate, startOfWeek, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { StatusIcon } from "@/components/task/task-meta";
import type { TaskItem } from "@/types/views";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseMonth(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

interface Entry {
  task: TaskItem;
  kind: "due" | "start";
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const today = todayIn(user.timezone, requestTime());
  const month = parseMonth((await searchParams).month, today.slice(0, 7));
  const gridStart = startOfWeek(`${month}-01`);
  const gridEnd = addDays(gridStart, 41);

  const projectIds = await listUserProjectIds(user.id);
  const projects = (await getProjects(projectIds)).filter((p) => !p.archived);
  const tasks = await listScheduledTasks(
    projects.map((p) => p.id),
    gridStart,
    gridEnd,
  );
  const items = await toTaskItems(tasks, projects);

  const byDay = new Map<string, Entry[]>();
  const push = (day: string, entry: Entry) => byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  for (const t of items) {
    if (t.dueDate) push(t.dueDate, { task: t, kind: "due" });
    if (t.startDate && t.startDate !== t.dueDate) push(t.startDate, { task: t, kind: "start" });
  }
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthLabel = formatCalendarDate(`${month}-01`, { month: "long", year: "numeric", day: undefined });
  const hrefFor = (taskId: string) => `/calendar?month=${month}&task=${taskId}`;
  const agenda = days.filter((d) => d.startsWith(month) && byDay.has(d));

  return (
    <>
      <PageHeader
        title={monthLabel}
        description="Start and due dates across your projects"
        actions={
          <>
            <Link href={`/calendar?month=${shiftMonth(month, -1)}`} className={buttonClasses("outline", "icon")} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href="/calendar" className={buttonClasses("outline", "md")}>
              Today
            </Link>
            <Link href={`/calendar?month=${shiftMonth(month, 1)}`} className={buttonClasses("outline", "icon")} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      {/* Month grid on larger screens */}
      <Card className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-border bg-surface-2/50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-muted">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const entries = byDay.get(day) ?? [];
            const inMonth = day.startsWith(month);
            return (
              <div
                key={day}
                className={cn(
                  "min-h-28 border-border p-1.5",
                  i % 7 !== 6 && "border-r",
                  i < 35 && "border-b",
                  !inMonth && "bg-surface-2/40",
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={cn(
                      "tabular flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs",
                      day === today ? "bg-accent font-semibold text-accent-fg" : inMonth ? "text-fg" : "text-subtle",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {entries.slice(0, 4).map(({ task, kind }) => (
                    <li key={`${task.id}-${kind}`}>
                      <Link
                        href={hrefFor(task.id)}
                        scroll={false}
                        title={`${task.ref} ${task.title} · ${kind === "due" ? "due" : "starts"}`}
                        className={cn(
                          "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] hover:bg-hover",
                          kind === "due" && task.status !== "DONE" && day < today && "text-danger",
                          task.status === "DONE" && "text-subtle line-through",
                        )}
                      >
                        {kind === "start" ? (
                          <PlayCircle className="h-3 w-3 shrink-0 text-subtle" aria-label="Starts" />
                        ) : (
                          <StatusIcon status={task.status} className="h-3 w-3" />
                        )}
                        <span className="truncate">{task.title}</span>
                      </Link>
                    </li>
                  ))}
                  {entries.length > 4 ? <li className="px-1.5 text-[11px] text-subtle">+{entries.length - 4} more</li> : null}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Agenda on small screens */}
      <div className="space-y-3 md:hidden">
        {agenda.length === 0 ? (
          <Card className="px-4 py-10 text-center text-[13px] text-subtle">Nothing scheduled this month.</Card>
        ) : (
          agenda.map((day) => (
            <Card key={day}>
              <p className={cn("border-b border-border px-4 py-2 text-xs font-medium", day === today ? "text-accent" : "text-muted")}>
                {formatCalendarDate(day, { weekday: "long" })}
              </p>
              <ul className="divide-y divide-border">
                {(byDay.get(day) ?? []).map(({ task, kind }) => (
                  <li key={`${task.id}-${kind}`}>
                    <Link href={hrefFor(task.id)} scroll={false} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] hover:bg-hover">
                      {kind === "start" ? (
                        <PlayCircle className="h-3.5 w-3.5 text-subtle" aria-hidden />
                      ) : (
                        <Flag className="h-3.5 w-3.5 text-subtle" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      <span className="text-xs text-subtle">{kind === "start" ? "Starts" : "Due"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
