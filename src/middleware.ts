import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/transaction",
  "/admin",
  "/topup",
  "/deposit",
  "/profile",
];

/**
 * Edge middleware ringan — hanya cek keberadaan cookie session.
 * Validasi sebenarnya tetap dilakukan di server (auth.service / requireAdmin)
 * karena middleware tidak bisa akses Prisma.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("pt_session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/transaction/:path*",
    "/admin/:path*",
    "/topup/:path*",
    "/deposit/:path*",
    "/profile/:path*",
  ],
};
