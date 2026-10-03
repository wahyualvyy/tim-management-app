import { z } from "zod";
import { ACCOUNT_STATUSES, GLOBAL_ROLES } from "@/types/user";
import { idSchema } from "./common";

export const userIdSchema = z.object({ userId: idSchema });
export const setAccountStatusSchema = z.object({ userId: idSchema, status: z.enum(ACCOUNT_STATUSES) });
export const setGlobalRoleSchema = z.object({ userId: idSchema, role: z.enum(GLOBAL_ROLES) });
