import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Pages reachable without a session. */
const PUBLIC_PATHS = new Set(["/login", "/verify"]);

/**
 * A strict Content Security Policy with a fresh nonce per request. Scripts
 * run only with the nonce (plus what they load, via 'strict-dynamic'); no
 * 'unsafe-eval' outside development. Inline style attributes are allowed
 * because UI libraries position popovers with them; styles cannot run code.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const blob = "https://*.public.blob.vercel-storage.com";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://lh3.googleusercontent.com ${blob}`,
    "font-src 'self'",
    // Direct uploads go from the browser to Vercel Blob.
    `connect-src 'self' https://vercel.com https://blob.vercel-storage.com https://*.blob.vercel-storage.com${dev ? " ws: wss:" : ""}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Sets the CSP and does an optimistic auth check: visitors without a session
 * are sent to /login before any page renders. Real authorization still
 * happens on the server in every page, route and action.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  if (!PUBLIC_PATHS.has(pathname)) {
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET });
    if (!token?.uid) {
      const url = new URL("/login", request.url);
      if (pathname !== "/") url.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
  } else if (pathname === "/login" && !request.nextUrl.searchParams.has("error")) {
    // A login page with an error (e.g. the account record is missing) must stay reachable.
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET });
    if (token?.uid) return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // API routes check the session themselves and return JSON or files (with their own headers).
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
