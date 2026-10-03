const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Epoch ms of UTC midnight for an ISO calendar date. Used as a sortable score. */
export function isoDateToScore(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** Today's calendar date (YYYY-MM-DD) in the given time zone. */
export function todayIn(timeZone: string, now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week that contains the given date. */
export function startOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -day);
}

/** Epoch ms of local midnight for an ISO date in a time zone. */
export function zonedMidnight(isoDate: string, timeZone: string): number {
  const utcGuess = Date.parse(`${isoDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcGuess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return utcGuess - (asUtc - utcGuess);
}

export function formatCalendarDate(isoDate: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(Date.parse(`${isoDate}T00:00:00Z`));
}

export function formatDateTime(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeTimeZone(timeZone),
  }).format(epochMs);
}

export function formatLongDate(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: safeTimeZone(timeZone),
  }).format(epochMs);
}

export function formatRelative(epochMs: number, now: number): string {
  const diff = Math.round((epochMs - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / (86400 * 30)), "month");
}

/** "1h 05m", "12m", "0m". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

/** "01:38:42". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Relative wording for a due date compared to today. */
export function dueLabel(dueDate: string, today: string): { text: string; tone: "overdue" | "today" | "soon" | "normal" } {
  if (dueDate < today) return { text: formatCalendarDate(dueDate), tone: "overdue" };
  if (dueDate === today) return { text: "Today", tone: "today" };
  if (dueDate === addDays(today, 1)) return { text: "Tomorrow", tone: "soon" };
  return { text: formatCalendarDate(dueDate), tone: "normal" };
}
