import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Optimistic auth check: unauthenticated visitors are sent to /login before
 * any page renders. Real authorization still happens on the server in every
 * page and action.
 */
export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (!token?.uid && !isLogin) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  // A login page with an error (e.g. the account record is missing) must stay reachable.
  if (token?.uid && isLogin && !request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|verify).*)"],
};
