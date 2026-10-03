export interface ActiveTimer {
  userId: string;
  taskId: string;
  projectId: string;
  /** Epoch ms taken from the server clock when the timer started. */
  startedAt: number;
}

export type TimeLogSource = "timer" | "manual";

export interface TimeLog {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  source: TimeLogSource;
  note: string;
  createdAt: number;
}

/** Seconds tracked per user for one task, module, sub module or project. */
export interface TimeSummary {
  totalSeconds: number;
  byUser: Record<string, number>;
}
