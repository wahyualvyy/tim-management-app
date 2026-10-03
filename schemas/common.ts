import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

export const idSchema = z.uuid({ message: "ID tidak valid." });

/** Empty string from a form field becomes null; otherwise a valid YYYY-MM-DD date. */
export const optionalDateSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || isIsoDate(v), { message: "Tanggal tidak valid." })
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

/** A list of ids from a multi-select (repeated form keys) or an array. */
export const idListSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => [...new Set((Array.isArray(v) ? v : v ? [v] : []).map((s) => s.trim()).filter(Boolean))])
  .pipe(z.array(idSchema).max(20, { message: "Maksimal 20 orang." }));

export const checkboxSchema = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

export function text(max: number) {
  return z.string().trim().max(max, { message: `Maksimal ${max} karakter.` });
}

export function requiredText(label: string, max: number) {
  return z
    .string({ message: `${label} wajib diisi.` })
    .trim()
    .min(1, { message: `${label} wajib diisi.` })
    .max(max, { message: `${label} maksimal ${max} karakter.` });
}
