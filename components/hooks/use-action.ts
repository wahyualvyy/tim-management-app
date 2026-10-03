"use client";

import { useCallback, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionResult, FieldErrors } from "@/types/action";

interface Options<T> {
  onSuccess?: (data: T) => void;
  successMessage?: string;
}

/**
 * Runs a server action inside a transition, surfaces errors as toasts and
 * exposes field errors for forms.
 */
export function useAction<I, T>(action: (input: I) => Promise<ActionResult<T>>, options: Options<T> = {}) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const toast = useToast();
  const { onSuccess, successMessage } = options;

  const run = useCallback(
    (input: I) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action(input);
          } catch {
            result = { ok: false, error: "Network error. Check your connection and try again." };
          }
          if (result.ok) {
            setFieldErrors({});
            if (successMessage) toast.success(successMessage);
            onSuccess?.(result.data);
          } else {
            setFieldErrors(result.fieldErrors ?? {});
            toast.error(result.error);
          }
          resolve(result);
        });
      }),
    [action, onSuccess, successMessage, toast],
  );

  return { run, pending, fieldErrors };
}
