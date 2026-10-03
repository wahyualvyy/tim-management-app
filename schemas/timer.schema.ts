import { z } from "zod";
import { idSchema, text } from "./common";
import { isIsoDate } from "@/lib/dates";

export const startTimerSchema = z.object({ taskId: idSchema });

export const manualTimeSchema = z.object({
  taskId: idSchema,
  minutes: z.coerce
    .number({ message: "Enter minutes." })
    .int({ message: "Use whole minutes." })
    .min(1, { message: "Enter at least 1 minute." })
    .max(24 * 60, { message: "A single entry can be at most 24 hours." }),
  date: z.string().trim().refine(isIsoDate, { message: "Use a valid date." }),
  note: text(300).default(""),
});

export const timeLogIdSchema = z.object({ logId: idSchema });
