import { z } from "zod";
import { STRUCTURE_STATUSES } from "@/types/module";
import { idSchema, optionalIdSchema, requiredText, text } from "./common";

const fields = {
  name: requiredText("Nama", 80),
  description: text(1000).default(""),
  status: z.enum(STRUCTURE_STATUSES).default("PLANNED"),
  leadId: optionalIdSchema,
};

export const createModuleSchema = z.object({ projectId: idSchema, ...fields });
export const updateModuleSchema = z.object({ moduleId: idSchema, ...fields });
export const moduleIdSchema = z.object({ moduleId: idSchema });
export const reorderModulesSchema = z.object({ projectId: idSchema, moduleIds: z.array(idSchema).max(500) });

export const createSubModuleSchema = z.object({ moduleId: idSchema, ...fields });
export const updateSubModuleSchema = z.object({ subModuleId: idSchema, ...fields });
export const subModuleIdSchema = z.object({ subModuleId: idSchema });
export const reorderSubModulesSchema = z.object({ moduleId: idSchema, subModuleIds: z.array(idSchema).max(500) });
