import { z } from "zod";
import { requiredText, text } from "./common";
import { safeTimeZone } from "@/lib/dates";

export const updateProfileSchema = z.object({
  name: requiredText("Display name", 60),
  jobTitle: text(80).default(""),
  bio: text(500).default(""),
  timezone: z
    .string()
    .trim()
    .refine((tz) => safeTimeZone(tz) === tz, { message: "Choose a valid time zone." }),
});

export const themeSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
});
