/**
 * Pure time-tracking arithmetic, shared by the server (finalizing logs) and
 * the browser (display). All inputs are absolute epoch-millisecond
 * timestamps, so the result does not depend on how often anything ticked.
 */

/** Whole seconds between two timestamps, never negative. */
export function secondsBetween(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

/** Seconds of the running session only. */
export function sessionSeconds(startedAt: number, now: number): number {
  return secondsBetween(startedAt, now);
}

/** Total shown for a task: finalized time plus the running session, if any. */
export function totalWithRunning(trackedSeconds: number, startedAt: number | null, now: number): number {
  return Math.max(0, trackedSeconds) + (startedAt === null ? 0 : sessionSeconds(startedAt, now));
}

/** Sessions shorter than this are treated as accidental clicks and not saved. */
export const MIN_SESSION_SECONDS = 1;

export function shouldRecordSession(seconds: number): boolean {
  return seconds >= MIN_SESSION_SECONDS;
}
