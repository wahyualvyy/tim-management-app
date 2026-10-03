import type { ProgressStats } from "./project";

export const MODULE_STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export interface Module {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: ModuleStatus;
  ownerId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface ModuleWithStats extends Module {
  stats: ProgressStats;
}
