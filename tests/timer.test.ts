import { describe, expect, it } from "vitest";
import { secondsBetween, sessionSeconds, shouldRecordSession, totalWithRunning } from "@/lib/timer";
import { formatClock, formatDuration } from "@/lib/dates";

const T0 = Date.UTC(2026, 9, 3, 8, 0, 0);

describe("timer arithmetic is based on timestamps only", () => {
  it("measures a session from absolute timestamps", () => {
    expect(secondsBetween(T0, T0 + 90 * 60_000 + 42_000)).toBe(5442);
  });

  it("is unaffected by how long the browser was asleep or in the background", () => {
    // A tab throttled for an hour reports the same value as one that ticked every second.
    const oneHourLater = T0 + 3600_000;
    expect(sessionSeconds(T0, oneHourLater)).toBe(3600);
  });

  it("survives a reload: a new page with the same startedAt shows the same elapsed time", () => {
    const now = T0 + 5 * 60_000;
    expect(sessionSeconds(T0, now)).toBe(sessionSeconds(T0, now));
  });

  it("never returns negative time when clocks disagree", () => {
    expect(secondsBetween(T0, T0 - 5000)).toBe(0);
  });

  it("adds the running session to previously finalized time", () => {
    expect(totalWithRunning(1800, T0, T0 + 600_000)).toBe(2400);
    expect(totalWithRunning(1800, null, T0 + 600_000)).toBe(1800);
  });

  it("discards accidental zero-length sessions", () => {
    expect(shouldRecordSession(0)).toBe(false);
    expect(shouldRecordSession(1)).toBe(true);
  });
});

describe("time formatting", () => {
  it("formats a clock as HH:MM:SS", () => {
    expect(formatClock(5053)).toBe("01:24:13");
    expect(formatClock(0)).toBe("00:00:00");
  });

  it("formats durations in Indonesian units", () => {
    expect(formatDuration(5442)).toBe("1j 30m");
    expect(formatDuration(59)).toBe("0m");
  });
});
