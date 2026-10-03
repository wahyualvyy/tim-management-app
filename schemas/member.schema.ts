import { z } from "zod";
import { idSchema } from "./common";

const assignable = z.enum(["LEAD", "MEMBER", "VIEWER"]);

export const addMemberSchema = z.object({
  projectId: idSchema,
  userId: z.string({ message: "Pilih orang yang akan ditambahkan." }).pipe(idSchema),
  role: assignable.default("MEMBER"),
});

export const changeMemberRoleSchema = z.object({ projectId: idSchema, userId: idSchema, role: assignable });

export const removeMemberSchema = z.object({ projectId: idSchema, userId: idSchema });
