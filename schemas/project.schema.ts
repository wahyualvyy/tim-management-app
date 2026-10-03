import { z } from "zod";
import { PROJECT_ICONS, PROJECT_STATUSES } from "@/types/project";
import { checkboxSchema, idSchema, optionalDateSchema, requiredText, text } from "./common";

export const projectKeySchema = z
  .string({ message: "Key is required." })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/, { message: "Use 2–6 letters or digits, starting with a letter." });

const projectFields = {
  name: requiredText("Name", 80),
  key: projectKeySchema,
  description: text(2000).default(""),
  icon: z.enum(PROJECT_ICONS).default("folder"),
  status: z.enum(PROJECT_STATUSES).default("ACTIVE"),
  startDate: optionalDateSchema,
  targetDate: optionalDateSchema,
};

function datesInOrder(v: { startDate: string | null; targetDate: string | null }): boolean {
  return !v.startDate || !v.targetDate || v.startDate <= v.targetDate;
}

export const createProjectSchema = z
  .object(projectFields)
  .refine(datesInOrder, { message: "Target date must be after the start date.", path: ["targetDate"] });

export const updateProjectSchema = z
  .object({
    projectId: idSchema,
    ...projectFields,
    allowViewerComments: checkboxSchema,
  })
  .refine(datesInOrder, { message: "Target date must be after the start date.", path: ["targetDate"] });

export const projectIdSchema = z.object({ projectId: idSchema });

export const deleteProjectSchema = z.object({
  projectId: idSchema,
  confirmKey: z.string().trim().toUpperCase(),
});

export type CreateProjectValues = z.infer<typeof createProjectSchema>;
