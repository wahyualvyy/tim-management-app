import "server-only";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";

/**
 * Per-project search index: one hash per project whose fields are
 * "task:{id}" / "module:{id}" and whose values are lowercased searchable text.
 * A search reads one hash per accessible project (pipelined) instead of
 * loading every task record.
 */
export type SearchKind = "task" | "module";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  projectId: string;
}

export function searchField(kind: SearchKind, id: string): string {
  return `${kind}:${id}`;
}

export function searchText(...parts: string[]): string {
  return parts.join(" ").toLowerCase().slice(0, 500);
}

export async function searchProjects(
  projectIds: readonly string[],
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q || projectIds.length === 0) return [];
  const pipe = redis().pipeline();
  for (const id of projectIds) pipe.hgetall(keys.projectSearch(id));
  const results = (await pipe.exec()) as unknown[];
  const hits: SearchHit[] = [];
  results.forEach((raw, index) => {
    const projectId = projectIds[index];
    if (!projectId || !Array.isArray(raw)) return;
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const field = String(raw[i]);
      const text = String(raw[i + 1]);
      if (!text.includes(q)) continue;
      const [kind, id] = field.split(":");
      if ((kind === "task" || kind === "module") && id) hits.push({ kind, id, projectId });
    }
  });
  // Modules first: fewer of them and they are broader navigation targets.
  hits.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "module" ? -1 : 1));
  return hits.slice(0, limit);
}
