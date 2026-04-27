import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;

  // Protect all /dashboard/* routes
  if (pathname.startsWith("/dashboard")) {
    // If both are missing, the user is definitely logged out
    if (!accessToken && !refreshToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // If we have refreshToken but no accessToken, the client-side axios interceptor
    // will handle the refresh on the first API call.
  }

  // If already logged in and visiting /login, redirect to dashboard
  // But don't redirect if there's an error param (e.g., session expired)
  if (pathname === "/login" && (accessToken || refreshToken) && !request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
