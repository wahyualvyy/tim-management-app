import "server-only";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { findUserIdByEmail, upsertOAuthUser } from "@/lib/redis/repositories/user.repository";

/**
 * Auth.js (NextAuth v4) with Google OAuth and JWT sessions.
 * Users live in Redis; the JWT only carries the internal user id.
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const email = profile?.email;
      if (!email) return "/login?error=NoEmail";
      try {
        const emailVerified = profile && "email_verified" in profile ? profile.email_verified === true : false;
        const picture = profile && "picture" in profile && typeof profile.picture === "string" ? profile.picture : null;
        await upsertOAuthUser({ email, name: profile.name ?? "", image: picture, emailVerified });
        return true;
      } catch (error) {
        console.error("Sign-in failed while saving the user", error);
        return "/login?error=Unavailable";
      }
    },
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        const id = await findUserIdByEmail(profile.email);
        if (id) token.uid = id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
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
