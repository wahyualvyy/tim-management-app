import type { ProgressStats } from "./project";

export const STRUCTURE_STATUSES = ["PLANNED", "IN_PROGRESS", "DONE"] as const;
export type StructureStatus = (typeof STRUCTURE_STATUSES)[number];

/** A top-level area of a project, e.g. "Frontend". */
export interface Module {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: StructureStatus;
  leadId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** A part of a module, e.g. "Landing Page". Tasks usually live here. */
export interface SubModule {
  id: string;
  projectId: string;
  moduleId: string;
  name: string;
  description: string;
  status: StructureStatus;
  leadId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface SubModuleWithStats extends SubModule {
  stats: ProgressStats;
  trackedSeconds: number;
}

export interface ModuleWithStats extends Module {
  stats: ProgressStats;
  trackedSeconds: number;
  subModules: SubModuleWithStats[];
}
