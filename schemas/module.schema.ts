import { z } from "zod";
import { MODULE_STATUSES } from "@/types/module";
import { idSchema, optionalIdSchema, requiredText, text } from "./common";

const moduleFields = {
  name: requiredText("Name", 80),
  description: text(1000).default(""),
  status: z.enum(MODULE_STATUSES).default("PLANNED"),
  ownerId: optionalIdSchema,
};

export const createModuleSchema = z.object({ projectId: idSchema, ...moduleFields });

export const updateModuleSchema = z.object({ moduleId: idSchema, ...moduleFields });

export const moduleIdSchema = z.object({ moduleId: idSchema });

export const reorderModulesSchema = z.object({
  projectId: idSchema,
  moduleIds: z.array(idSchema).max(500),
});
