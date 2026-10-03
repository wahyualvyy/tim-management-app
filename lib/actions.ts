import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { ActionResult, FieldErrors } from "@/types/action";

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fieldErrors: FieldErrors,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Parse untrusted input (FormData or a plain object) with a Zod schema,
 * throwing a ValidationError with field messages.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const raw = input instanceof FormData ? formDataToObject(input) : input;
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fieldErrors = z.flattenError(result.error).fieldErrors as FieldErrors;
    const first = result.error.issues[0]?.message ?? "Please check the highlighted fields.";
    throw new ValidationError(first, fieldErrors);
  }
  return result.data;
}

/** Convert FormData to a plain object; repeated keys become arrays. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

/**
 * Runs an action body and converts failures to a predictable result.
 * Known AppErrors carry user-safe messages; anything else is logged and
 * reported generically so internals never reach the client.
 */
export async function runAction<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await body();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    if (isRedirectOrNotFound(error)) throw error;
    console.error("Action failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function isRedirectOrNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  const digest = (error as { digest: unknown }).digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"));
}
