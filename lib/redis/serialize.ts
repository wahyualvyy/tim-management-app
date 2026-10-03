/** Helpers for reading Redis hashes whose values are always strings. */
export type RawHash = Record<string, string>;

/**
 * HGETALL without automatic deserialization returns a flat [field, value, ...]
 * array; an object form is accepted too. Empty or missing hashes become null.
 */
export function toRawHash(value: unknown): RawHash | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const out: RawHash = {};
    for (let i = 0; i + 1 < value.length; i += 2) out[String(value[i])] = String(value[i + 1] ?? "");
    return out;
  }
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;
  const out: RawHash = {};
  for (const [k, v] of entries) out[k] = v === null || v === undefined ? "" : String(v);
  return out;
}

export function str(hash: RawHash, field: string): string {
  return hash[field] ?? "";
}

export function strOrNull(hash: RawHash, field: string): string | null {
  const v = hash[field];
  return v ? v : null;
}

export function num(hash: RawHash, field: string, fallback = 0): number {
  const v = Number(hash[field]);
  return hash[field] !== undefined && hash[field] !== "" && Number.isFinite(v) ? v : fallback;
}

export function numOrNull(hash: RawHash, field: string): number | null {
  const raw = hash[field];
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

export function bool(hash: RawHash, field: string): boolean {
  return hash[field] === "1";
}

export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

export function stringArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function stringRecord(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

type HashValue = string | number | boolean | null | string[] | Record<string, string>;

/** Convert a domain object to a flat string hash for HSET. Nulls become "". */
export function toHash(values: Record<string, HashValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === null) out[k] = "";
    else if (typeof v === "boolean") out[k] = v ? "1" : "0";
    else if (typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}

/** Upstash returns pipeline results positionally; this narrows them to strings. */
export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}
