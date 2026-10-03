import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import { idListSchema, idSchema, optionalDateSchema, optionalIdSchema, requiredText, text } from "./common";

export const labelsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    const list = Array.isArray(v) ? v : (v ?? "").split(",");
    return [...new Set(list.map((l) => l.trim().toLowerCase()).filter(Boolean))];
  })
  .pipe(
    z
      .array(z.string().max(24, { message: "Label maksimal 24 karakter." }))
      .max(8, { message: "Maksimal 8 label." }),
  );

export const estimateSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 100_000), {
    message: "Estimasi harus berupa menit (bilangan bulat).",
  });

function datesInOrder(v: { startDate?: string | null; dueDate?: string | null }): boolean {
  return !v.startDate || !v.dueDate || v.startDate <= v.dueDate;
}
const dateMessage = { message: "Tenggat harus pada atau setelah tanggal mulai.", path: ["dueDate"] };

export const createTaskSchema = z
  .object({
    projectId: idSchema,
    moduleId: idSchema,
    subModuleId: optionalIdSchema,
    title: requiredText("Judul", 200),
    description: text(10_000).default(""),
    status: z.enum(TASK_STATUSES).default("TODO"),
    priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
    assigneeIds: idListSchema,
    startDate: optionalDateSchema,
    dueDate: optionalDateSchema,
    labels: labelsSchema,
    estimatedMinutes: estimateSchema,
    /** Quick add places the task at the top of its column. */
    placeOnTop: z.boolean().optional(),
  })
  .refine(datesInOrder, dateMessage);

/** Partial update: only the fields present are changed; unknown fields are rejected. */
export const updateTaskSchema = z
  .object({
    taskId: idSchema,
    title: requiredText("Judul", 200).optional(),
    description: text(10_000).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeIds: idListSchema.optional(),
    moduleId: idSchema.optional(),
    subModuleId: optionalIdSchema.optional(),
    startDate: optionalDateSchema.optional(),
    dueDate: optionalDateSchema.optional(),
    labels: labelsSchema.optional(),
    estimatedMinutes: estimateSchema.optional(),
  })
  .strict();

export const moveTaskSchema = z.object({
  taskId: idSchema,
  status: z.enum(TASK_STATUSES),
  /** New board position; omitted when only the column changes. */
  order: z.number().finite().optional(),
});

export const completeTaskSchema = z.object({
  taskId: idSchema,
  completionNotes: text(4000).default(""),
});

export const taskIdSchema = z.object({ taskId: idSchema });

export const attachmentIdSchema = z.object({ taskId: idSchema, attachmentId: idSchema });
