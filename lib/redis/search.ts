import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray } from "./serialize";
import { entry, entryId, normalizeText, prefixRange, words } from "@/lib/search-terms";

/**
 * Per-project prefix index over modules, sub modules and tasks:
 * a sorted set (score 0) of "{term}|{kind}:{id}". A query reads a bounded
 * number of entries per project with ZRANGE BYLEX, so search cost does not
 * grow with the number of tasks. Callers verify multi-word queries against
 * the loaded records.
 */
export const SEARCH_KINDS = ["module", "submodule", "task"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchHit {
  kind: SearchKind;
  id: string;
  projectId: string;
}

export function searchMembers(kind: SearchKind, id: string, terms: string[]): string[] {
  return terms.map((t) => entry(t, `${kind}:${id}`));
}

/** The most selective query word (longest) drives the prefix lookup. */
function lookupTerm(query: string): string {
  const all = words(query);
  if (all.length === 0) return normalizeText(query);
  return all.reduce((a, b) => (b.length > a.length ? b : a));
}

const RANK: Record<SearchKind, number> = { module: 0, submodule: 1, task: 2 };

export async function searchProjects(projectIds: readonly string[], query: string, perProject: number): Promise<SearchHit[]> {
  const range = prefixRange(lookupTerm(query));
  if (!range || projectIds.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of projectIds) pipe.zrange(keys.projectSearch(id), range.min, range.max, { byLex: true, offset: 0, count: perProject });
  const results = (await pipe.exec()) as unknown[];
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  results.forEach((raw, i) => {
    const projectId = projectIds[i];
    if (!projectId) return;
    for (const value of asStringArray(raw)) {
      const ref = entryId(value);
      if (seen.has(ref)) continue;
      seen.add(ref);
      const [kind, id] = ref.split(":");
      if ((SEARCH_KINDS as readonly string[]).includes(kind ?? "") && id) hits.push({ kind: kind as SearchKind, id, projectId });
    }
  });
  return hits.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}
