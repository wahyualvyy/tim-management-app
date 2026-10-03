import { z } from "zod";

export const verifyTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{20,100}$/, { message: "This verification link is invalid." }),
});
