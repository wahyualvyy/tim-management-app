import "server-only";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getUser, findUserIdByAccount, upsertOAuthUser } from "@/lib/redis/users";
import { logError } from "@/lib/log";

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Auth.js (NextAuth v4) with Google and JWT sessions. Users and provider
 * accounts are stored in Redis by our own data layer (no database adapter);
 * the encrypted session cookie only carries the internal user id.
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  // Encrypted JWT in an httpOnly, SameSite=Lax cookie (Secure when NEXTAUTH_URL is https).
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !account.providerAccountId) return false;
      const email = profile?.email;
      if (!email) return "/login?error=NoEmail";
      try {
        const emailVerified = profile && "email_verified" in profile ? profile.email_verified === true : false;
        const picture = profile && "picture" in profile && typeof profile.picture === "string" ? profile.picture : null;
        const user = await upsertOAuthUser({
          provider: "google",
          providerAccountId: account.providerAccountId,
          email,
          name: profile.name ?? "",
          image: picture,
          emailVerified,
          isAdmin: adminEmails().has(email.toLowerCase()),
        });
        if (user.status === "SUSPENDED") return "/login?error=Suspended";
        return true;
      } catch (error) {
        logError("auth.signIn", error);
        return "/login?error=Unavailable";
      }
    },
    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        const id = await findUserIdByAccount(account.provider, account.providerAccountId);
        if (id) {
          token.uid = id;
          token.sv = (await getUser(id))?.sessionVersion ?? 0;
        }
      }
      return token;
    },
    // Pages load the full user from Redis themselves, so the session stays a cheap token read.
    session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid;
        session.user.sessionVersion = token.sv ?? 0;
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // ignore malformed urls
      }
      return baseUrl;
    },
  },
};
