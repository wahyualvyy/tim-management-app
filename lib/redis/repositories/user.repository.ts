import "server-only";
import { redis } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import { numOrNull, num, oneOf, str, strOrNull, toHash, toRawHash, type RawHash } from "@/lib/redis/serialize";
import { newId } from "@/lib/utils";
import type { ThemePreference, User } from "@/types/user";

const THEMES: readonly ThemePreference[] = ["light", "dark", "system"];

function parseUser(hash: RawHash): User {
  return {
    id: str(hash, "id"),
    name: str(hash, "name"),
    email: str(hash, "email"),
    emailVerified: numOrNull(hash, "emailVerified"),
    avatar: strOrNull(hash, "avatar"),
    jobTitle: str(hash, "jobTitle"),
    bio: str(hash, "bio"),
    timezone: str(hash, "timezone") || "UTC",
    themePreference: oneOf(hash.themePreference, THEMES, "system"),
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
  results.forEach((raw) => {
    const hash = toRawHash(raw);
    if (hash) {
      const user = parseUser(hash);
      map.set(user.id, user);
    }
  });
  return map;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const id = await redis().get<string>(keys.userByEmail(email));
  return id ?? null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const id = await findUserIdByEmail(email);
  return id ? getUser(id) : null;
}

interface OAuthProfile {
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
}

/**
 * Create the user on first sign-in, or refresh verification on later ones.
 * The email index is claimed with SET NX so concurrent first logins cannot
 * create two accounts for one email. Profile fields the user edits in the app
 * (name, avatar) are not overwritten by later OAuth logins.
 */
export async function upsertOAuthUser(profile: OAuthProfile): Promise<User> {
  const email = profile.email.toLowerCase();
  const r = redis();
  const candidateId = newId();
  const claimed = await r.set(keys.userByEmail(email), candidateId, { nx: true });
  const now = Date.now();
  const existingId = claimed === "OK" ? null : await findUserIdByEmail(email);
  const existing = existingId ? await getUser(existingId) : null;

  // New account, or an email index left behind by a failed earlier write.
  if (!existing) {
    const user: User = {
      id: existingId ?? candidateId,
      name: profile.name || email.split("@")[0] || email,
      email,
      emailVerified: profile.emailVerified ? now : null,
      avatar: profile.image,
      jobTitle: "",
      bio: "",
      timezone: "UTC",
      themePreference: "system",
      createdAt: now,
      updatedAt: now,
    };
    await r.hset(keys.user(user.id), toHash({ ...user }));
    return user;
  }

  if (profile.emailVerified && existing.emailVerified === null) {
    await r.hset(keys.user(existing.id), { emailVerified: String(now), updatedAt: String(now) });
    return { ...existing, emailVerified: now, updatedAt: now };
  }
  return existing;
}

export type ProfilePatch = Partial<Pick<User, "name" | "avatar" | "jobTitle" | "bio" | "timezone" | "themePreference">>;

export async function updateUser(userId: string, patch: ProfilePatch): Promise<void> {
  const values: Record<string, string | null> = { ...patch, updatedAt: String(Date.now()) };
  await redis().hset(keys.user(userId), toHash(values));
}

export async function markEmailVerified(userId: string): Promise<void> {
  const now = String(Date.now());
  await redis().hset(keys.user(userId), { emailVerified: now, updatedAt: now });
}
