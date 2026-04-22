import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const session = request.cookies.get("firebase-token");
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const path = request.nextUrl.pathname;

  if ((path.startsWith("/dashboard") || path === "/onboarding") && !session && !isDemoMode) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (path === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard/devices", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/onboarding"],
};
