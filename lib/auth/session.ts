import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "./options";
import { getUser } from "@/lib/redis/users";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { isSuspended } from "@/lib/permissions";
import type { User } from "@/types/user";

/**
 * The signed-in user, loaded fresh from Redis once per request. A session
 * issued before "sign out everywhere" (older session version) is rejected.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  const user = await getUser(id);
  if (!user || (session.user.sessionVersion ?? 0) !== user.sessionVersion) return null;
  return user;
});

/** For pages: redirect to login when there is no usable session. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=SessionExpired");
  if (isSuspended(user)) redirect("/login?error=Suspended");
  return user;
}

/** For server actions: the user id always comes from the session, never from the client. */
export async function requireActionUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (isSuspended(user)) throw new ForbiddenError("Akun Anda ditangguhkan. Hubungi admin.");
  return user;
}
