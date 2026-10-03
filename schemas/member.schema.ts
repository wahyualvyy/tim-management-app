import { z } from "zod";
import { idSchema } from "./common";

const assignable = z.enum(["LEAD", "MEMBER", "VIEWER"]);

export const addMemberSchema = z.object({
  projectId: idSchema,
  email: z.email({ message: "Enter a valid email address." }).trim().toLowerCase(),
  role: assignable.default("MEMBER"),
});

export const changeMemberRoleSchema = z.object({
  projectId: idSchema,
  userId: idSchema,
  role: assignable,
});

export const removeMemberSchema = z.object({
  projectId: idSchema,
  userId: idSchema,
});
