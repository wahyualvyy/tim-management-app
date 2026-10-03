import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

export const idSchema = z.uuid({ message: "Invalid identifier." });

/** Empty string from a form field becomes null; otherwise a valid YYYY-MM-DD date. */
export const optionalDateSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || isIsoDate(v), { message: "Use a valid date." })
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** Empty string becomes null; otherwise an id. */
export const optionalIdSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(idSchema.nullable())
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const checkboxSchema = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

export function text(max: number) {
  return z.string().trim().max(max, { message: `Keep it under ${max} characters.` });
}

export function requiredText(label: string, max: number) {
  return z
    .string({ message: `${label} is required.` })
    .trim()
    .min(1, { message: `${label} is required.` })
    .max(max, { message: `${label} must be under ${max} characters.` });
}
