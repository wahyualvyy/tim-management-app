"use server";

import { z } from "zod";
import { requireActionUser } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/actions";
import { getProjects, getMembers, listUserProjectIds } from "@/lib/redis/repositories/project.repository";
import { searchProjects } from "@/lib/redis/repositories/search.repository";
import { getTasks } from "@/lib/redis/repositories/task.repository";
import { getModule } from "@/lib/redis/repositories/module.repository";
import { getUsers } from "@/lib/redis/repositories/user.repository";
import { taskHref, taskRef } from "@/lib/utils";
import type { ActionResult } from "@/types/action";

const searchSchema = z.object({ query: z.string().trim().min(1).max(100) });

export interface SearchResult {
  kind: "project" | "module" | "task" | "member";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  avatar?: string | null;
}

export async function searchAction(input: unknown): Promise<ActionResult<SearchResult[]>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { query } = parseInput(searchSchema, input);
    const q = query.toLowerCase();
    const projectIds = await listUserProjectIds(user.id);
    if (projectIds.length === 0) return [];

    const [projects, hits, memberLists] = await Promise.all([
      getProjects(projectIds),
      searchProjects(projectIds, q, 20),
      Promise.all(projectIds.map((id) => getMembers(id))),
    ]);
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const results: SearchResult[] = [];

    for (const p of projects) {
      if (p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)) {
        results.push({ kind: "project", id: p.id, title: p.name, subtitle: p.key, href: `/projects/${p.id}` });
      }
    }

    const moduleHits = hits.filter((h) => h.kind === "module").slice(0, 6);
    const modules = await Promise.all(moduleHits.map((h) => getModule(h.id)));
    for (const m of modules) {
      const p = m ? projectMap.get(m.projectId) : undefined;
      if (m && p) {
        results.push({
          kind: "module",
          id: m.id,
          title: m.name,
          subtitle: p.name,
          href: `/projects/${p.id}/modules#module-${m.id}`,
        });
      }
    }

    const tasks = await getTasks(hits.filter((h) => h.kind === "task").map((h) => h.id).slice(0, 12));
    for (const t of tasks) {
      const p = projectMap.get(t.projectId);
      if (p) {
        results.push({
          kind: "task",
          id: t.id,
          title: t.title,
          subtitle: `${taskRef(p.key, t.number)} · ${p.name}`,
          href: taskHref(p.id, t.id),
        });
      }
    }

    // Members are people who share at least one project with the searcher.
    const memberIds = [...new Set(memberLists.flat().map((m) => m.userId))];
    const users = await getUsers(memberIds);
    let memberCount = 0;
    for (const u of users.values()) {
      if (memberCount >= 6) break;
      if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) {
        const firstShared = projectIds.find((pid, i) => memberLists[i]?.some((m) => m.userId === u.id));
        results.push({
          kind: "member",
          id: u.id,
          title: u.name,
          subtitle: u.jobTitle || u.email,
          href: firstShared ? `/projects/${firstShared}/members` : "/projects",
          avatar: u.avatar,
        });
        memberCount++;
      }
    }
    return results;
  });
}
