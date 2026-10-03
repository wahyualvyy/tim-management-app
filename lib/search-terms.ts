/**
 * Text normalization and term extraction for the Redis prefix indexes.
 *
 * Index entries are stored in sorted sets with score 0 as "{term}|{id}", so
 * a prefix query is a ZRANGE BYLEX between "[{prefix}" and "[{prefix}ÿ".
 * Terms only contain [a-z0-9@._-] and spaces, so "|" never appears in a term
 * and every entry sorts by term first.
 */

export const TERM_SEPARATOR = "|";
export const LEX_MAX_SUFFIX = "ÿ";

/** Lowercase, strip accents, keep only index-safe characters, collapse spaces. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@._\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words of at least 2 characters, deduplicated. */
export function words(value: string): string[] {
  return [...new Set(normalizeText(value).split(" ").filter((w) => w.length >= 2))];
}

export function entry(term: string, id: string): string {
  return `${term}${TERM_SEPARATOR}${id}`;
}

/** The id part of an index entry. */
export function entryId(value: string): string {
  const i = value.lastIndexOf(TERM_SEPARATOR);
  return i >= 0 ? value.slice(i + 1) : value;
}

/** Exclusive lower bound after a cursor entry. */
export function after(cursorEntry: string): `(${string}` {
  return `(${cursorEntry}`;
}

/** Bounds for a prefix query, or null when the query has nothing searchable. */
export function prefixRange(query: string): { min: `[${string}`; max: `[${string}` } | null {
  const q = normalizeText(query);
  if (q.length === 0) return null;
  return { min: `[${q}`, max: `[${q}${LEX_MAX_SUFFIX}` };
}

/** Searchable terms for a person: full name, each name word, username and email. */
export function userTerms(user: { name: string; username: string; email: string }): string[] {
  const email = user.email.toLowerCase();
  const local = email.split("@")[0] ?? "";
  const full = normalizeText(user.name);
  return [...new Set([full, ...words(user.name), normalizeText(user.username), local, email].filter((t) => t.length >= 2))];
}

/** Sort key for alphabetical member lists. */
export function nameSortKey(name: string, id: string): string {
  return entry(normalizeText(name) || "~", id);
}

/** Searchable terms for a task: its reference, title words and labels. */
export function taskTerms(task: { title: string; labels: string[] }, ref: string): string[] {
  return [...new Set([normalizeText(ref), ...words(task.title), ...task.labels.flatMap(words)].filter((t) => t.length >= 2))];
}

/** Searchable terms for a module or sub module: full name and each word. */
export function nodeTerms(name: string): string[] {
  const full = normalizeText(name);
  return [...new Set([full, ...words(name)].filter((t) => t.length >= 2))];
}

/** All query words must appear in the haystack (used to verify prefix hits). */
export function matchesAllWords(haystack: string, query: string): boolean {
  const text = normalizeText(haystack);
  return words(query).every((w) => text.includes(w)) || normalizeText(query).length < 2;
}
