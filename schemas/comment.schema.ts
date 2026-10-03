import { z } from "zod";
import { idSchema, requiredText } from "./common";

export const createCommentSchema = z.object({ taskId: idSchema, body: requiredText("Komentar", 5000) });
export const updateCommentSchema = z.object({ commentId: idSchema, body: requiredText("Komentar", 5000) });
export const commentIdSchema = z.object({ commentId: idSchema });
