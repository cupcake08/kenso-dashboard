import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("firebase-token");

  if (request.nextUrl.pathname.startsWith("/dashboard") && !session && process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (request.nextUrl.pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard/devices", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
