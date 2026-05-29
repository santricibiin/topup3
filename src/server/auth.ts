/**
 * Helper auth untuk API Route / Server Component.
 * Token disimpan di cookie httpOnly: `pt_session`.
 *
 * `getCurrentUser` di-wrap React.cache → dedupe panggilan dalam 1 request.
 * Kalau dipanggil di layout + page sekaligus, query Prisma cuma jalan sekali.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { authService } from "@/services/auth.service";

export const SESSION_COOKIE = "pt_session";

export const getCurrentUser = cache(async () => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return authService.getUserByToken(token);
});

export async function getCurrentUserFromRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return authService.getUserByToken(token);
}

export function setSessionCookie(token: string, expiresAt: Date) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}
