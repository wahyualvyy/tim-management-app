import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Tracked time per day for the last 7 days. Bars are scaled to the busiest
 * day; today is highlighted. Plain HTML so it needs no chart library.
 */
export function WeekChart({ days }: { days: { date: string; label: string; seconds: number; isToday: boolean }[] }) {
  const max = Math.max(...days.map((d) => d.seconds), 1);
  const total = days.reduce((sum, d) => sum + d.seconds, 0);
  return (
    <figure>
      <figcaption className="sr-only">Waktu kerja 7 hari terakhir, total {formatDuration(total)}</figcaption>
      <div className="flex h-28 items-end gap-2" role="list">
        {days.map((d) => (
          <div key={d.date} role="listitem" className="flex flex-1 flex-col items-center gap-1.5" title={`${d.label}: ${formatDuration(d.seconds)}`}>
            <div className="flex h-20 w-full items-end">
              <div
                className={cn("w-full rounded-t-md", d.isToday ? "bg-accent" : "bg-accent/30", d.seconds === 0 && "bg-border")}
                style={{ height: `${Math.max(d.seconds === 0 ? 2 : 6, (d.seconds / max) * 100)}%` }}
              />
            </div>
            <span className={cn("text-[11px]", d.isToday ? "font-medium text-fg" : "text-subtle")}>{d.label}</span>
            <span className="sr-only">{formatDuration(d.seconds)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
