import { z } from "zod";
import { idSchema, text } from "./common";
import { isIsoDate } from "@/lib/dates";

export const startTimerSchema = z.object({
  taskId: idSchema,
  /** Confirms stopping a timer that is running on another task. */
  replaceRunning: z.boolean().optional(),
});

export const manualTimeSchema = z.object({
  taskId: idSchema,
  minutes: z.coerce
    .number({ message: "Masukkan jumlah menit." })
    .int({ message: "Gunakan menit bulat." })
    .min(1, { message: "Minimal 1 menit." })
    .max(24 * 60, { message: "Satu entri maksimal 24 jam." }),
  date: z.string().trim().refine(isIsoDate, { message: "Tanggal tidak valid." }),
  note: text(300).default(""),
});

export const timeLogIdSchema = z.object({ logId: idSchema });
