import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import { idSchema, optionalDateSchema, optionalIdSchema, requiredText, text } from "./common";

export const labelsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    const list = Array.isArray(v) ? v : (v ?? "").split(",");
    const cleaned = list.map((l) => l.trim().toLowerCase()).filter(Boolean);
    return [...new Set(cleaned)];
  })
  .pipe(
    z
      .array(z.string().max(24, { message: "Labels must be under 24 characters." }))
      .max(8, { message: "Use at most 8 labels." }),
  );

export const estimateSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 100_000), {
    message: "Estimate must be a whole number of minutes.",
  });

function datesInOrder(v: { startDate?: string | null; dueDate?: string | null }): boolean {
  return !v.startDate || !v.dueDate || v.startDate <= v.dueDate;
}

export const createTaskSchema = z
  .object({
    projectId: idSchema,
    moduleId: idSchema,
    title: requiredText("Title", 200),
    description: text(10_000).default(""),
    status: z.enum(TASK_STATUSES).default("TODO"),
    priority: z.enum(TASK_PRIORITIES).default("NONE"),
    assigneeId: optionalIdSchema,
    startDate: optionalDateSchema,
    dueDate: optionalDateSchema,
    labels: labelsSchema,
    estimateMinutes: estimateSchema,
  })
  .refine(datesInOrder, { message: "Due date must be on or after the start date.", path: ["dueDate"] });

/** Partial update: only the fields present are changed. */
export const updateTaskSchema = z
  .object({
    taskId: idSchema,
    title: requiredText("Title", 200).optional(),
    description: text(10_000).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: optionalIdSchema.optional(),
    moduleId: idSchema.optional(),
    startDate: optionalDateSchema.optional(),
    dueDate: optionalDateSchema.optional(),
    labels: labelsSchema.optional(),
    estimateMinutes: estimateSchema.optional(),
  })
  .strict();

export const setTaskStatusSchema = z.object({
  taskId: idSchema,
  status: z.enum(TASK_STATUSES),
});

export const completeTaskSchema = z.object({
  taskId: idSchema,
  completionNotes: text(4000).default(""),
});

export const taskIdSchema = z.object({ taskId: idSchema });

export const attachmentIdSchema = z.object({ taskId: idSchema, attachmentId: idSchema });
