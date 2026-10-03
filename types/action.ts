export type FieldErrors = Record<string, string[] | undefined>;

/**
 * Every server action returns this shape. `code` lets the UI react to
 * specific failures (e.g. an already running timer) without parsing text.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; meta?: Record<string, string>; fieldErrors?: FieldErrors };
