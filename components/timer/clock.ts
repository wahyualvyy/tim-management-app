"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared one-second clock for displaying running timers.
 *
 * Elapsed time is never accumulated here: displays compute
 * `serverNow() - startedAt` from absolute timestamps, so throttled
 * intervals in background tabs, sleep, or remounts cannot drift the value.
 * The tick only decides how often the UI re-renders.
 */
let now = 0;
let skewMs = 0;
let intervalId: number | null = null;
const listeners = new Set<() => void>();

function tick() {
  now = Date.now() + skewMs;
  for (const listener of listeners) listener();
}

function onVisibility() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (intervalId === null) {
    tick();
    intervalId = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", tick);
    }
  };
}

/** Align the client clock with the server so elapsed time matches the stored start. */
export function syncServerTime(serverNow: number) {
  skewMs = serverNow - Date.now();
  if (listeners.size > 0) tick();
}

const getSnapshot = () => now;
const getServerSnapshot = () => 0;

/** Current server-aligned time in ms; 0 until mounted on the client. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
