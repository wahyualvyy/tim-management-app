import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getUser } from "@/lib/redis/repositories/user.repository";
import { UnauthorizedError } from "@/lib/errors";
import type { User } from "@/types/user";

/** The signed-in user, loaded fresh from Redis once per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  return getUser(id);
});

/** For pages: redirect to login when there is no valid session. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=SessionExpired");
  return user;
}

/** For server actions: the user id always comes from the session, never from the client. */
export async function requireActionUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
