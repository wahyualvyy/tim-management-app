"use client";

import { useCallback, useState, useTransition } from "react";
import { z } from "zod";
import { useToast } from "@/components/ui/toast";
import type { ActionResult, FieldErrors } from "@/types/action";

interface Options<T> {
  onSuccess?: (data: T) => void;
  /** Called for failures; return true to suppress the default error toast. */
  onError?: (result: Extract<ActionResult<T>, { ok: false }>) => boolean | void;
  successMessage?: string;
  /** Validated in the browser before calling the server (which validates again). */
  schema?: z.ZodType;
}

function toObject(input: unknown): unknown {
  if (!(input instanceof FormData)) return input;
  const out: Record<string, unknown> = {};
  for (const [key, value] of input.entries()) {
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

/**
 * Runs a server action inside a transition: optional client-side validation,
 * field errors for forms, toast feedback, and success/error callbacks.
 */
export function useAction<I, T>(action: (input: I) => Promise<ActionResult<T>>, options: Options<T> = {}) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const toast = useToast();
  const { onSuccess, onError, successMessage, schema } = options;

  const run = useCallback(
    (input: I) =>
      new Promise<ActionResult<T>>((resolve) => {
        if (schema) {
          const check = schema.safeParse(toObject(input));
          if (!check.success) {
            setFieldErrors(z.flattenError(check.error).fieldErrors as FieldErrors);
            resolve({ ok: false, error: check.error.issues[0]?.message ?? "Periksa kembali isian Anda.", code: "VALIDATION" });
            return;
          }
        }
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action(input);
          } catch {
            result = { ok: false, error: "Koneksi bermasalah. Periksa jaringan Anda lalu coba lagi.", code: "NETWORK" };
          }
          if (result.ok) {
            setFieldErrors({});
            if (successMessage) toast.success(successMessage);
            onSuccess?.(result.data);
          } else {
            setFieldErrors(result.fieldErrors ?? {});
            if (!onError?.(result)) toast.error(result.error);
          }
          resolve(result);
        });
      }),
    [action, onError, onSuccess, schema, successMessage, toast],
  );

  return { run, pending, fieldErrors, setFieldErrors };
}
