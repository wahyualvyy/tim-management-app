import "server-only";
import { redis } from "./client";
import { keys } from "./keys";
import { asStringArray, num, numOrNull, oneOf, str, strOrNull, toHash, toRawHash, type RawHash } from "./serialize";
import { ConflictError } from "@/lib/errors";
import { newId } from "@/lib/utils";
import { entry, entryId, prefixRange, userTerms } from "@/lib/search-terms";
import { ACCOUNT_STATUSES, GLOBAL_ROLES, type AccountStatus, type GlobalRole, type ThemePreference, type User } from "@/types/user";

const THEMES: readonly ThemePreference[] = ["light", "dark", "system"];

export function parseUser(hash: RawHash): User {
  return {
    id: str(hash, "id"),
    name: str(hash, "name"),
    username: str(hash, "username"),
    email: str(hash, "email"),
    emailVerified: numOrNull(hash, "emailVerified"),
    avatar: strOrNull(hash, "avatar"),
    providerAvatar: strOrNull(hash, "providerAvatar"),
    jobTitle: str(hash, "jobTitle"),
    bio: str(hash, "bio"),
    whatsapp: str(hash, "whatsapp"),
    location: str(hash, "location"),
    timezone: str(hash, "timezone") || "Asia/Jakarta",
    themePreference: oneOf(hash.themePreference, THEMES, "system"),
    provider: str(hash, "provider"),
    providerAccountId: str(hash, "providerAccountId"),
    status: oneOf(hash.status, ACCOUNT_STATUSES, "UNVERIFIED"),
    role: oneOf(hash.role, GLOBAL_ROLES, "USER"),
    sessionVersion: num(hash, "sessionVersion"),
    createdAt: num(hash, "createdAt"),
    updatedAt: num(hash, "updatedAt"),
  };
}

export async function getUser(userId: string): Promise<User | null> {
  const hash = toRawHash(await redis().hgetall(keys.user(userId)));
  return hash ? parseUser(hash) : null;
}

/** Batch-load users in one round trip. Missing users are omitted. */
export async function getUsers(userIds: readonly string[]): Promise<Map<string, User>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, User>();
  if (unique.length === 0) return map;
  const pipe = redis().pipeline();
  for (const id of unique) pipe.hgetall(keys.user(id));
  const results = (await pipe.exec()) as unknown[];
  for (const raw of results) {
    const hash = toRawHash(raw);
    if (hash) {
      const user = parseUser(hash);
      map.set(user.id, user);
    }
  }
  return map;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  return (await redis().get<string>(keys.userByEmail(email))) ?? null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const id = await findUserIdByEmail(email);
  return id ? getUser(id) : null;
}

/** Resolve usernames to user ids in one command (unknown names are skipped). */
export async function findUserIdsByUsernames(usernames: readonly string[]): Promise<string[]> {
  const names = [...new Set(usernames.map(normalizeUsername).filter(Boolean))].slice(0, 20);
  if (names.length === 0) return [];
  const raw: unknown = await redis().mget(...names.map((n) => keys.userByUsername(n)));
  return (Array.isArray(raw) ? raw : []).filter((v): v is string => typeof v === "string" && v.length > 0);
}

export async function findUserIdByAccount(provider: string, accountId: string): Promise<string | null> {
  return (await redis().get<string>(keys.userByAccount(provider, accountId))) ?? null;
}

export function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 30);
}

/** Claims a free username derived from `base`, trying base, base2, base3… */
async function claimUsername(base: string, userId: string): Promise<string> {
  const clean = normalizeUsername(base);
  const root = clean.length >= 3 ? clean : `user${clean}`;
  const r = redis();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root.slice(0, 26)}${i + 1}`;
    if ((await r.set(keys.userByUsername(candidate), userId, { nx: true })) === "OK") return candidate;
  }
  const fallback = `${root.slice(0, 20)}${newId().slice(0, 8)}`;
  await r.set(keys.userByUsername(fallback), userId);
  return fallback;
}

export interface OAuthProfile {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
}

/**
 * Create the user on first sign-in, or refresh provider data on later ones.
 * Lookup is by provider account first, then by email (accounts imported from
 * the old system are linked on their first Google sign-in). The email index
 * is claimed with SET NX so concurrent first logins can't create two users.
 * Fields the user edits in the app are never overwritten.
 */
export async function upsertOAuthUser(profile: OAuthProfile): Promise<User> {
  const r = redis();
  const email = profile.email.toLowerCase();
  const now = Date.now();

  let userId = await findUserIdByAccount(profile.provider, profile.providerAccountId);
  if (!userId) {
    const candidate = newId();
    const claimed = await r.set(keys.userByEmail(email), candidate, { nx: true });
    userId = claimed === "OK" ? candidate : await findUserIdByEmail(email);
  }
  if (!userId) throw new Error("Could not resolve a user id for this sign-in");

  const existing = await getUser(userId);
  if (!existing) {
    const user: User = {
      id: userId,
      name: profile.name || email.split("@")[0] || email,
      username: await claimUsername(email.split("@")[0] ?? "user", userId),
      email,
      emailVerified: profile.emailVerified ? now : null,
      avatar: profile.image,
      providerAvatar: profile.image,
      jobTitle: "",
      bio: "",
      whatsapp: "",
      location: "",
      timezone: "Asia/Jakarta",
      themePreference: "system",
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      status: profile.emailVerified ? "VERIFIED" : "UNVERIFIED",
      role: profile.isAdmin ? "ADMIN" : "USER",
      sessionVersion: 0,
      createdAt: now,
      updatedAt: now,
    };
    const tx = r.multi();
    tx.hset(keys.user(userId), toHash({ ...user }));
    tx.set(keys.userByAccount(profile.provider, profile.providerAccountId), userId);
    tx.set(keys.userByEmail(email), userId);
    tx.zadd(keys.users(), { score: now, member: userId });
    for (const term of userTerms(user)) tx.zadd(keys.usersSearch(), { score: 0, member: entry(term, userId) });
    await tx.exec();
    return user;
  }

  // Returning user: link the provider account and refresh provider data.
  const patch: Partial<Record<keyof User, string>> = {
    provider: profile.provider,
    providerAccountId: profile.providerAccountId,
    providerAvatar: profile.image ?? "",
    updatedAt: String(now),
  };
  // Keep following the provider photo unless the user uploaded their own.
  if (!existing.avatar || existing.avatar === existing.providerAvatar) patch.avatar = profile.image ?? "";
  if (profile.emailVerified && existing.emailVerified === null) patch.emailVerified = String(now);
  if (profile.emailVerified && existing.status === "UNVERIFIED") patch.status = "VERIFIED";
  if (profile.isAdmin && existing.role !== "ADMIN") patch.role = "ADMIN";
  if (!existing.username) patch.username = await claimUsername(email.split("@")[0] ?? "user", userId);
  const tx = r.multi();
  tx.hset(keys.user(userId), patch);
  tx.set(keys.userByAccount(profile.provider, profile.providerAccountId), userId);
  tx.zadd(keys.users(), { score: existing.createdAt || now, member: userId });
  await tx.exec();
  const fresh = (await getUser(userId)) ?? existing;
  // Re-adding all terms is idempotent and also indexes accounts created before the index existed.
  await reindexUserSearch(null, fresh);
  return fresh;
}

export type ProfilePatch = Partial<
  Pick<User, "name" | "avatar" | "jobTitle" | "bio" | "whatsapp" | "location" | "timezone" | "themePreference">
>;

export async function updateUser(userId: string, patch: ProfilePatch): Promise<void> {
  await redis().hset(keys.user(userId), toHash({ ...patch, updatedAt: Date.now() }));
}

/** Replace a user's entries in the global search index (no-op when terms are unchanged). */
export async function reindexUserSearch(before: Pick<User, "id" | "name" | "username" | "email"> | null, after: Pick<User, "id" | "name" | "username" | "email">): Promise<void> {
  const oldTerms = before ? userTerms(before) : [];
  const newTerms = userTerms(after);
  const removed = oldTerms.filter((t) => !newTerms.includes(t));
  const added = newTerms.filter((t) => !oldTerms.includes(t));
  if (removed.length === 0 && added.length === 0) return;
  const tx = redis().multi();
  if (removed.length > 0) tx.zrem(keys.usersSearch(), ...removed.map((t) => entry(t, after.id)));
  for (const t of added) tx.zadd(keys.usersSearch(), { score: 0, member: entry(t, after.id) });
  await tx.exec();
}

/**
 * Prefix search over all users (name words, username, email). Reads at most
 * `limit` index entries per query, so cost does not grow with the user count.
 */
export async function searchUsers(query: string, limit: number): Promise<User[]> {
  const range = prefixRange(query);
  if (!range) return [];
  const raw = asStringArray(await redis().zrange(keys.usersSearch(), range.min, range.max, { byLex: true, offset: 0, count: limit * 4 }));
  const ids = [...new Set(raw.map(entryId))].slice(0, limit);
  const map = await getUsers(ids);
  return ids.flatMap((id) => {
    const u = map.get(id);
    return u ? [u] : [];
  });
}

/** Sign out everywhere: every existing session token becomes invalid. */
export async function bumpSessionVersion(userId: string): Promise<void> {
  await redis().hincrby(keys.user(userId), "sessionVersion", 1);
}

/** Change a username atomically: the new name is claimed before the old one is released. */
export async function changeUsername(user: User, next: string): Promise<void> {
  const username = normalizeUsername(next);
  if (username === user.username) return;
  const r = redis();
  if ((await r.set(keys.userByUsername(username), user.id, { nx: true })) !== "OK") {
    throw new ConflictError("Username sudah dipakai. Coba yang lain.");
  }
  const tx = r.multi();
  tx.hset(keys.user(user.id), { username, updatedAt: String(Date.now()) });
  if (user.username) tx.del(keys.userByUsername(user.username));
  await tx.exec();
}

export async function setAccountStatus(userId: string, status: AccountStatus): Promise<void> {
  await redis().hset(keys.user(userId), { status, updatedAt: String(Date.now()) });
}

export async function setGlobalRole(userId: string, role: GlobalRole): Promise<void> {
  await redis().hset(keys.user(userId), { role, updatedAt: String(Date.now()) });
}

/** Newest users first, for the admin screen. */
export async function listUsers(offset: number, limit: number): Promise<{ users: User[]; hasMore: boolean }> {
  const ids = asStringArray(await redis().zrange(keys.users(), offset, offset + limit, { rev: true }));
  const map = await getUsers(ids.slice(0, limit));
  return {
    users: ids.slice(0, limit).flatMap((id) => {
      const u = map.get(id);
      return u ? [u] : [];
    }),
    hasMore: ids.length > limit,
  };
}

export async function countUsers(): Promise<number> {
  return redis().zcard(keys.users());
}
