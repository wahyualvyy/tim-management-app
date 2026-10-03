import { z } from "zod";
import { PROJECT_COLORS, PROJECT_ICONS, PROJECT_STATUSES } from "@/types/project";
import { checkboxSchema, idSchema, optionalDateSchema, requiredText, text } from "./common";

export const projectKeySchema = z
  .string({ message: "Kode wajib diisi." })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/, { message: "Gunakan 2–6 huruf/angka, diawali huruf." });

const fields = {
  name: requiredText("Nama proyek", 80),
  key: projectKeySchema,
  description: text(2000).default(""),
  icon: z.enum(PROJECT_ICONS).default("folder"),
  color: z.enum(PROJECT_COLORS).default("blue"),
  status: z.enum(PROJECT_STATUSES).default("ACTIVE"),
  startDate: optionalDateSchema,
  dueDate: optionalDateSchema,
};

function datesInOrder(v: { startDate: string | null; dueDate: string | null }): boolean {
  return !v.startDate || !v.dueDate || v.startDate <= v.dueDate;
}
const dateMessage = { message: "Tenggat harus setelah tanggal mulai.", path: ["dueDate"] };

export const createProjectSchema = z.object(fields).refine(datesInOrder, dateMessage);

export const updateProjectSchema = z
  .object({ projectId: idSchema, ...fields, allowViewerComments: checkboxSchema })
  .refine(datesInOrder, dateMessage);

export const projectStatusSchema = z.object({ projectId: idSchema, status: z.enum(PROJECT_STATUSES) });

export const deleteProjectSchema = z.object({
  projectId: idSchema,
  confirmKey: z.string().trim().toUpperCase(),
});
