import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, PlayCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { StatusIcon } from "@/components/task/task-meta";
import { addDays, formatCalendarDate, startOfWeek } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/types/views";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export type ScheduleMode = "month" | "week";

export interface ScheduleRange {
  mode: ScheduleMode;
  /** First visible day (a Monday). */
  from: string;
  /** Last visible day. */
  to: string;
  /** YYYY-MM for month mode, the Monday for week mode. */
  anchor: string;
}

export function parseSchedule(params: { view?: string; at?: string }, today: string): ScheduleRange {
  const mode: ScheduleMode = params.view === "week" ? "week" : "month";
  if (mode === "week") {
    const anchor = startOfWeek(params.at && /^\d{4}-\d{2}-\d{2}$/.test(params.at) ? params.at : today);
    return { mode, from: anchor, to: addDays(anchor, 6), anchor };
  }
  const month = params.at && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.at) ? params.at : today.slice(0, 7);
  const from = startOfWeek(`${month}-01`);
  return { mode, from, to: addDays(from, 41), anchor: month };
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

interface Entry {
  task: TaskItem;
  kind: "due" | "start";
}

/**
 * Month or week grid of task start and due dates, plus an upcoming list.
 * Clicking an item opens the task drawer. Server component: links only.
 */
export function ScheduleView({
  basePath,
  range,
  today,
  tasks,
  showProject,
}: {
  basePath: string;
  range: ScheduleRange;
  today: string;
  tasks: TaskItem[];
  showProject: boolean;
}) {
  const byDay = new Map<string, Entry[]>();
  const push = (day: string, entry: Entry) => byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  for (const t of tasks) {
    if (t.dueDate) push(t.dueDate, { task: t, kind: "due" });
    if (t.startDate && t.startDate !== t.dueDate) push(t.startDate, { task: t, kind: "start" });
  }
  const dayCount = range.mode === "week" ? 7 : 42;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(range.from, i));
  const query = (view: ScheduleMode, at: string) => `${basePath}?view=${view}&at=${at}`;
  const taskHref = (taskId: string) => `${query(range.mode, range.anchor)}&task=${taskId}`;
  const prev = range.mode === "week" ? addDays(range.anchor, -7) : shiftMonth(range.anchor, -1);
  const next = range.mode === "week" ? addDays(range.anchor, 7) : shiftMonth(range.anchor, 1);
  const title =
    range.mode === "week"
      ? `${formatCalendarDate(range.from)} – ${formatCalendarDate(range.to, { year: "numeric" })}`
      : formatCalendarDate(`${range.anchor}-01`, { month: "long", year: "numeric", day: undefined });
  const upcoming = tasks
    .filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate >= today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 10);
  const inPeriod = (day: string) => (range.mode === "week" ? true : day.startsWith(range.anchor));
  const agenda = days.filter((d) => inPeriod(d) && byDay.has(d));

  const itemClass = (entry: Entry, day: string) =>
    cn(
      "flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] hover:bg-hover",
      entry.kind === "due" && entry.task.status !== "DONE" && day < today && "text-danger",
      entry.task.status === "DONE" && "text-subtle line-through",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold capitalize">{title}</h2>
        <div className="inline-flex rounded-md bg-surface-2 p-0.5 text-xs" role="group" aria-label="Tampilan">
          {(["month", "week"] as const).map((mode) => (
            <Link
              key={mode}
              href={query(mode, mode === "week" ? today : today.slice(0, 7))}
              aria-current={range.mode === mode ? "true" : undefined}
              className={cn("rounded-md px-2.5 py-1", range.mode === mode ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-fg")}
            >
              {mode === "month" ? "Bulan" : "Minggu"}
            </Link>
          ))}
        </div>
        <Link href={query(range.mode, prev)} className={buttonClasses("outline", "icon")} aria-label="Sebelumnya">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link href={basePath + (range.mode === "week" ? "?view=week" : "")} className={buttonClasses("outline", "md")}>
          Hari ini
        </Link>
        <Link href={query(range.mode, next)} className={buttonClasses("outline", "icon")} aria-label="Berikutnya">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
            <div className="grid grid-cols-7 border-b border-border">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-xs font-medium text-muted">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const entries = byDay.get(day) ?? [];
                const limit = range.mode === "week" ? 12 : 4;
                return (
                  <div
                    key={day}
                    className={cn(
                      "border-border p-1.5",
                      range.mode === "week" ? "min-h-72" : "min-h-28",
                      i % 7 !== 6 && "border-r",
                      i < dayCount - 7 && "border-b",
                      !inPeriod(day) && "bg-surface-2/50",
                    )}
                  >
                    <div className="mb-1 flex justify-end">
                      <span
                        className={cn(
                          "tabular flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs",
                          day === today ? "bg-accent font-semibold text-accent-fg" : inPeriod(day) ? "text-fg" : "text-subtle",
                        )}
                      >
                        {Number(day.slice(8))}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {entries.slice(0, limit).map((entry) => (
                        <li key={`${entry.task.id}-${entry.kind}`}>
                          <Link
                            href={taskHref(entry.task.id)}
                            scroll={false}
                            title={`${entry.task.ref} ${entry.task.title} · ${entry.kind === "due" ? "tenggat" : "mulai"}`}
                            className={itemClass(entry, day)}
                          >
                            {entry.kind === "start" ? (
                              <PlayCircle className="h-3 w-3 shrink-0 text-subtle" aria-label="Mulai" />
                            ) : (
                              <StatusIcon status={entry.task.status} className="h-3 w-3" />
                            )}
                            <span className="truncate">{entry.task.title}</span>
                          </Link>
                        </li>
                      ))}
                      {entries.length > limit ? <li className="px-1.5 text-[11px] text-subtle">+{entries.length - limit} lainnya</li> : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {agenda.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-4 py-10 text-center text-[13px] text-subtle">Tidak ada jadwal pada periode ini.</p>
            ) : (
              agenda.map((day) => (
                <section key={day} className="rounded-lg border border-border bg-surface">
                  <p className={cn("border-b border-border px-4 py-2 text-xs font-medium", day === today ? "text-accent" : "text-muted")}>
                    {formatCalendarDate(day, { weekday: "long" })}
                  </p>
                  <ul className="divide-y divide-border">
                    {(byDay.get(day) ?? []).map((entry) => (
                      <li key={`${entry.task.id}-${entry.kind}`}>
                        <Link href={taskHref(entry.task.id)} scroll={false} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] hover:bg-hover">
                          {entry.kind === "start" ? <PlayCircle className="h-3.5 w-3.5 text-subtle" aria-hidden /> : <Flag className="h-3.5 w-3.5 text-subtle" aria-hidden />}
                          <span className="min-w-0 flex-1 truncate">{entry.task.title}</span>
                          <span className="text-xs text-subtle">{entry.kind === "start" ? "Mulai" : "Tenggat"}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>

        <aside aria-label="Tenggat mendatang">
          <h3 className="mb-2 text-sm font-semibold">Tenggat mendatang</h3>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-subtle">Tidak ada tenggat mendatang pada periode ini.</p>
          ) : (
            <ul className="space-y-1">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <Link href={taskHref(t.id)} scroll={false} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-hover">
                    <StatusIcon status={t.status} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{t.title}</span>
                      <span className="block truncate text-[11px] text-subtle">
                        {t.ref}
                        {showProject ? ` · ${t.projectName}` : ""}
                      </span>
                    </span>
                    <span className={cn("tabular shrink-0 text-[11px]", t.dueDate === today ? "font-medium text-warning" : "text-muted")}>
                      {t.dueDate === today ? "Hari ini" : formatCalendarDate(t.dueDate ?? today)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
