import { z } from "zod";
import { requiredText, text } from "./common";
import { safeTimeZone } from "@/lib/dates";

export const usernameSchema = z
  .string({ message: "Username wajib diisi." })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,29}$/, {
    message: "3–30 karakter: huruf kecil, angka, titik, garis bawah atau tanda hubung.",
  });

export const updateProfileSchema = z.object({
  name: requiredText("Nama tampil", 60),
  username: usernameSchema,
  jobTitle: text(80).default(""),
  bio: text(500).default(""),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^\+?[0-9]{8,15}$/.test(v), { message: "Nomor WhatsApp tidak valid." })
    .default(""),
  location: text(80).default(""),
  timezone: z
    .string()
    .trim()
    .refine((tz) => safeTimeZone(tz) === tz, { message: "Pilih zona waktu yang valid." }),
});

export const themeSchema = z.object({ theme: z.enum(["light", "dark", "system"]) });
