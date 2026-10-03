import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray, toRawHash } from "./serialize";
import { getUsers } from "./users";
import { parseTimer } from "./timeLogs";
import { after as lexAfter, entry, entryId, nameSortKey, prefixRange, userTerms } from "@/lib/search-terms";
import { PROJECT_ROLES, type ProjectRole } from "@/types/project";
import { toPublicUser, type PublicUser, type User } from "@/types/user";

/**
 * Project membership and its indexes:
 *   project:{p}:members          hash  userId → role (authorization lookups, O(1))
 *   project:{p}:member_names     zset  lex "{name}|{userId}" (alphabetical pages)
 *   project:{p}:members:{ROLE}   zset  lex, same entries per role (role filter)
 *   project:{p}:member_joined    zset  score = joined time (newest first)
 *   project:{p}:member_search    zset  lex "{term}|{userId}" (prefix search)
 * Pages are read with cursors, so a project with 10 000 members costs the
 * same per page as one with 10.
 */

type Person = Pick<User, "id" | "name" | "username" | "email">;

export interface MemberView extends PublicUser {
  role: ProjectRole;
}

const ROLE_RANK: Record<ProjectRole, number> = { VIEWER: 0, MEMBER: 1, LEAD: 2, OWNER: 3 };

function isRole(value: unknown): value is ProjectRole {
  return typeof value === "string" && (PROJECT_ROLES as readonly string[]).includes(value);
}

export async function getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const role = await redis().hget<string>(keys.projectMembers(projectId), userId);
  return isRole(role) ? role : null;
}

/** Roles for several users in one command; non-members map to null. */
export async function getMemberRoles(projectId: string, userIds: readonly string[]): Promise<Map<string, ProjectRole | null>> {
  const out = new Map<string, ProjectRole | null>();
  if (userIds.length === 0) return out;
  const raw: unknown = await redis().hmget(keys.projectMembers(projectId), ...userIds);
  const values = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? userIds.map((id) => (raw as Record<string, unknown>)[id]) : [];
  userIds.forEach((id, i) => out.set(id, isRole(values[i]) ? values[i] : null));
  return out;
}

/** One user's role in several projects (one pipeline); missing memberships map to null. */
export async function getRolesInProjects(projectIds: readonly string[], userId: string): Promise<Map<string, ProjectRole | null>> {
  const out = new Map<string, ProjectRole | null>();
  if (projectIds.length === 0) return out;
  const pipe = redis().pipeline();
  for (const id of projectIds) pipe.hget(keys.projectMembers(id), userId);
  const results = (await pipe.exec()) as unknown[];
  projectIds.forEach((id, i) => out.set(id, isRole(results[i]) ? results[i] : null));
  return out;
}

export async function countMembers(projectId: string): Promise<number> {
  return redis().hlen(keys.projectMembers(projectId));
}

export async function countMembersByRole(projectId: string): Promise<Record<ProjectRole, number>> {
  const pipe = redis().pipeline();
  for (const role of PROJECT_ROLES) pipe.zcard(keys.projectMembersByRole(projectId, role));
  const results = (await pipe.exec()) as unknown[];
  return Object.fromEntries(PROJECT_ROLES.map((role, i) => [role, Number(results[i]) || 0])) as Record<ProjectRole, number>;
}

/** Ids of owners and leads (small sets), e.g. for review requests. */
export async function listLeadIds(projectId: string): Promise<string[]> {
  const pipe = redis().pipeline();
  pipe.zrange(keys.projectMembersByRole(projectId, "OWNER"), 0, -1);
  pipe.zrange(keys.projectMembersByRole(projectId, "LEAD"), 0, -1);
  const results = (await pipe.exec()) as unknown[];
  return [...new Set(results.flatMap(asStringArray).map(entryId))];
}

/** Every member id — only for cascades on project deletion, never for pages. */
export async function listAllMemberIds(projectId: string): Promise<string[]> {
  return Object.keys(toRawHash(await redis().hgetall(keys.projectMembers(projectId))) ?? {});
}

export async function addMember(projectId: string, user: Person, role: ProjectRole, joinedAt = Date.now()): Promise<void> {
  const sortEntry = nameSortKey(user.name, user.id);
  const tx = redis().multi();
  tx.hset(keys.projectMembers(projectId), { [user.id]: role });
  tx.zadd(keys.projectMemberNames(projectId), { score: 0, member: sortEntry });
  tx.zadd(keys.projectMembersByRole(projectId, role), { score: 0, member: sortEntry });
  tx.zadd(keys.projectMemberJoined(projectId), { score: joinedAt, member: user.id });
  for (const term of userTerms(user)) tx.zadd(keys.projectMemberSearch(projectId), { score: 0, member: entry(term, user.id) });
  tx.zadd(keys.userProjects(user.id), { score: joinedAt, member: projectId });
  await tx.exec();
}

export async function setMemberRole(projectId: string, user: Person, from: ProjectRole, to: ProjectRole): Promise<void> {
  const sortEntry = nameSortKey(user.name, user.id);
  const tx = redis().multi();
  tx.hset(keys.projectMembers(projectId), { [user.id]: to });
  tx.zrem(keys.projectMembersByRole(projectId, from), sortEntry);
  tx.zadd(keys.projectMembersByRole(projectId, to), { score: 0, member: sortEntry });
  await tx.exec();
}

/**
 * Remove a member: drops every membership index entry, unassigns their tasks
 * in this project (including their open/due/done task indexes) and stops a
 * timer they were running on this project.
 */
export async function removeMember(projectId: string, user: Person): Promise<void> {
  const r = redis();
  const [taskIds, timerRaw] = await Promise.all([r.zrange(keys.userTasks(user.id), 0, -1), r.get<string>(keys.userTimer(user.id))]);
  const ids = asStringArray(taskIds);
  const inProject: { id: string; assignees: string[] }[] = [];
  if (ids.length > 0) {
    const pipe = r.pipeline();
    for (const id of ids) pipe.hmget(keys.task(id), "projectId", "assigneeIds");
    const rows = (await pipe.exec()) as unknown[];
    ids.forEach((id, i) => {
      const row = rows[i];
      const [pid, assignees] = Array.isArray(row) ? row : row && typeof row === "object" ? Object.values(row) : [];
      if (pid !== projectId) return;
      let list: string[] = [];
      try {
        const parsed: unknown = JSON.parse(String(assignees ?? "[]"));
        if (Array.isArray(parsed)) list = parsed.filter((v): v is string => typeof v === "string");
      } catch {
        list = [];
      }
      inProject.push({ id, assignees: list });
    });
  }
  const role = await getMemberRole(projectId, user.id);
  const sortEntry = nameSortKey(user.name, user.id);
  const timer = parseTimer(timerRaw);
  const tx = r.multi();
  tx.hdel(keys.projectMembers(projectId), user.id);
  tx.zrem(keys.projectMemberNames(projectId), sortEntry);
  if (role) tx.zrem(keys.projectMembersByRole(projectId, role), sortEntry);
  tx.zrem(keys.projectMemberJoined(projectId), user.id);
  tx.zrem(keys.projectMemberSearch(projectId), ...userTerms(user).map((t) => entry(t, user.id)));
  tx.zrem(keys.userProjects(user.id), projectId);
  for (const t of inProject) {
    tx.hset(keys.task(t.id), { assigneeIds: JSON.stringify(t.assignees.filter((a) => a !== user.id)) });
    tx.zrem(keys.userTasks(user.id), t.id);
    tx.zrem(keys.userOpenTasks(user.id), t.id);
    tx.zrem(keys.userOpenDue(user.id), t.id);
    tx.zrem(keys.userDoneTasks(user.id), t.id);
  }
  if (timer?.projectId === projectId) {
    tx.del(keys.userTimer(user.id));
    tx.srem(keys.taskTimers(timer.taskId), user.id);
  }
  await tx.exec();
}

/** Keep every project's member indexes in sync after a name/username change. */
export async function reindexMemberEverywhere(before: Person, after: Person): Promise<void> {
  const oldSort = nameSortKey(before.name, before.id);
  const newSort = nameSortKey(after.name, after.id);
  const oldTerms = userTerms(before);
  const newTerms = userTerms(after);
  if (oldSort === newSort && oldTerms.join() === newTerms.join()) return;
  const r = redis();
  const projectIds = asStringArray(await r.zrange(keys.userProjects(after.id), 0, -1));
  for (let i = 0; i < projectIds.length; i += 50) {
    const batch = projectIds.slice(i, i + 50);
    const roles = r.pipeline();
    for (const p of batch) roles.hget(keys.projectMembers(p), after.id);
    const roleResults = (await roles.exec()) as unknown[];
    const tx = r.multi();
    batch.forEach((p, j) => {
      const role = roleResults[j];
      tx.zrem(keys.projectMemberNames(p), oldSort);
      tx.zadd(keys.projectMemberNames(p), { score: 0, member: newSort });
      if (isRole(role)) {
        tx.zrem(keys.projectMembersByRole(p, role), oldSort);
        tx.zadd(keys.projectMembersByRole(p, role), { score: 0, member: newSort });
      }
      if (oldTerms.length > 0) tx.zrem(keys.projectMemberSearch(p), ...oldTerms.map((t) => entry(t, after.id)));
      for (const t of newTerms) tx.zadd(keys.projectMemberSearch(p), { score: 0, member: entry(t, after.id) });
    });
    await tx.exec();
  }
}

export type MemberSort = "name" | "name_desc" | "joined";

export interface MemberPage {
  items: MemberView[];
  nextCursor: string | null;
}

async function toViews(projectId: string, ids: string[]): Promise<MemberView[]> {
  if (ids.length === 0) return [];
  const [users, roles] = await Promise.all([getUsers(ids), getMemberRoles(projectId, ids)]);
  return ids.flatMap((id) => {
    const u = users.get(id);
    const role = roles.get(id);
    return u && role ? [{ ...toPublicUser(u), role }] : [];
  });
}

/**
 * One page of members. Name sorts use the lex index with the last entry as
 * cursor; "joined" uses an offset cursor over the joined-time index.
 */
export async function listMembersPage(
  projectId: string,
  options: { role?: ProjectRole | null; sort?: MemberSort; cursor?: string | null; limit: number },
): Promise<MemberPage> {
  const r = redis();
  const { role, sort = "name", cursor, limit } = options;
  if (sort === "joined" && !role) {
    const offset = cursor?.startsWith("o:") ? Number(cursor.slice(2)) || 0 : 0;
    const ids = asStringArray(await r.zrange(keys.projectMemberJoined(projectId), offset, offset + limit, { rev: true }));
    return {
      items: await toViews(projectId, ids.slice(0, limit)),
      nextCursor: ids.length > limit ? `o:${offset + limit}` : null,
    };
  }
  const key = role ? keys.projectMembersByRole(projectId, role) : keys.projectMemberNames(projectId);
  const desc = sort === "name_desc";
  const start = cursor && !cursor.startsWith("o:") ? cursor : null;
  const raw = asStringArray(
    desc
      ? await r.zrange(key, start ? lexAfter(start) : "+", "-", { byLex: true, rev: true, offset: 0, count: limit + 1 })
      : await r.zrange(key, start ? lexAfter(start) : "-", "+", { byLex: true, offset: 0, count: limit + 1 }),
  );
  const page = raw.slice(0, limit);
  return {
    items: await toViews(projectId, page.map(entryId)),
    nextCursor: raw.length > limit ? (page[page.length - 1] ?? null) : null,
  };
}

/**
 * Prefix search over member names, usernames and emails, optionally limited
 * to roles at or above `minRole`. Reads a bounded number of index entries.
 */
export async function searchMembers(
  projectId: string,
  query: string,
  options: { minRole?: ProjectRole; role?: ProjectRole | null; limit: number },
): Promise<MemberView[]> {
  const range = prefixRange(query);
  if (!range) {
    const page = await listMembersPage(projectId, { role: options.role, limit: options.limit * 2 });
    return filterRoles(page.items, options).slice(0, options.limit);
  }
  const raw = asStringArray(
    await redis().zrange(keys.projectMemberSearch(projectId), range.min, range.max, { byLex: true, offset: 0, count: options.limit * 6 }),
  );
  const ids = [...new Set(raw.map(entryId))];
  const views = filterRoles(await toViews(projectId, ids), options);
  return views.sort((a, b) => a.name.localeCompare(b.name, "id")).slice(0, options.limit);
}

function filterRoles(items: MemberView[], options: { minRole?: ProjectRole; role?: ProjectRole | null }): MemberView[] {
  return items.filter(
    (m) => (!options.role || m.role === options.role) && (!options.minRole || ROLE_RANK[m.role] >= ROLE_RANK[options.minRole]),
  );
}

/** The first few members (alphabetical) and the total, for avatar stacks. */
export async function memberPreview(projectId: string, count: number): Promise<{ members: MemberView[]; total: number }> {
  const r = redis();
  const [raw, total] = await Promise.all([
    r.zrange(keys.projectMemberNames(projectId), "-", "+", { byLex: true, offset: 0, count }),
    r.hlen(keys.projectMembers(projectId)),
  ]);
  return { members: await toViews(projectId, asStringArray(raw).map(entryId)), total };
}
