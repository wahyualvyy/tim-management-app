"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/guards";
import { parseInput, runAction } from "@/lib/actions";
import { listUserProjectHeaders } from "@/lib/redis/projects";
import { searchProjects } from "@/lib/redis/search";
import { getTasks } from "@/lib/redis/tasks";
import { getModule, getSubModule } from "@/lib/redis/modules";
import { searchUsers } from "@/lib/redis/users";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { enforceRateLimit } from "@/lib/rate-limit";
import { matchesAllWords, normalizeText } from "@/lib/search-terms";
import { taskHref, taskRef } from "@/lib/utils";
import type { ActionResult } from "@/types/action";

const searchSchema = z.object({ query: z.string().trim().min(2).max(100) });

/** Search reaches into this many of the user's most recent projects. */
const PROJECT_SCOPE = 50;

export interface SearchResult {
  kind: "project" | "module" | "submodule" | "task" | "member";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  avatar?: string | null;
}

/**
 * Global search, limited to projects the user belongs to. Uses the prefix
 * indexes only: a bounded number of entries per project and per user index,
 * so cost does not grow with the size of the data.
 */
export async function searchAction(input: unknown): Promise<ActionResult<SearchResult[]>> {
  return runAction("search", async () => {
    const user = await requireAuth();
    const { query } = parseInput(searchSchema, input);
    await enforceRateLimit("search", user.id);
    const headers = await listUserProjectHeaders(user.id);
    if (headers.length === 0) return [];
    const q = normalizeText(query);
    const projectMap = new Map(headers.map((p) => [p.id, p]));
    const scope = headers.slice(0, PROJECT_SCOPE).map((p) => p.id);
    const results: SearchResult[] = [];

    for (const p of headers) {
      if (results.length >= 6) break;
      if (normalizeText(p.name).includes(q) || p.key.toLowerCase().includes(q)) {
        results.push({ kind: "project", id: p.id, title: p.name, subtitle: p.key, href: `/projects/${p.id}` });
      }
    }

    const hits = await searchProjects(scope, query, 10);
    const [modules, subModules, tasks] = await Promise.all([
      Promise.all(hits.filter((h) => h.kind === "module").slice(0, 6).map((h) => getModule(h.id))),
      Promise.all(hits.filter((h) => h.kind === "submodule").slice(0, 6).map((h) => getSubModule(h.id))),
      getTasks(hits.filter((h) => h.kind === "task").slice(0, 30).map((h) => h.id)),
    ]);
    for (const m of modules) {
      const p = m ? projectMap.get(m.projectId) : undefined;
      if (m && p && matchesAllWords(m.name, query)) {
        results.push({ kind: "module", id: m.id, title: m.name, subtitle: p.name, href: `/projects/${p.id}/structure#node-${m.id}` });
      }
    }
    for (const s of subModules) {
      const p = s ? projectMap.get(s.projectId) : undefined;
      if (s && p && matchesAllWords(s.name, query)) {
        results.push({ kind: "submodule", id: s.id, title: s.name, subtitle: p.name, href: `/projects/${p.id}/structure#node-${s.id}` });
      }
    }
    for (const t of tasks.slice(0, 12)) {
      const p = projectMap.get(t.projectId);
      const ref = p ? taskRef(p.key, t.number) : "";
      if (p && matchesAllWords(`${ref} ${t.title} ${t.labels.join(" ")}`, query)) {
        results.push({ kind: "task", id: t.id, title: t.title, subtitle: `${ref} · ${p.name}`, href: taskHref(p.id, t.id) });
      }
    }

    // People: prefix search over all users, kept only if they share a project with the searcher.
    const people = (await searchUsers(query, 10)).filter((u) => u.id !== user.id);
    if (people.length > 0) {
      const pipe = redis().pipeline();
      for (const person of people) for (const pid of scope) pipe.hget(keys.projectMembers(pid), person.id);
      const roles = (await pipe.exec()) as unknown[];
      people.forEach((person, i) => {
        const shared = scope.find((_, j) => typeof roles[i * scope.length + j] === "string");
        if (!shared) return;
        results.push({
          kind: "member",
          id: person.id,
          title: person.name,
          subtitle: `@${person.username}${person.jobTitle ? ` · ${person.jobTitle}` : ""}`,
          href: `/projects/${shared}/members?q=${encodeURIComponent(person.username)}`,
          avatar: person.avatar,
        });
      });
    }
    return results;
  });
}
