/**
 * Helper guard untuk halaman & API admin.
 * Lempar 404/redirect agar keberadaan endpoint tidak bocor ke non-admin.
 */
import { redirect } from "next/navigation";
import { Errors } from "@/lib/errors";
import { getCurrentUser, getCurrentUserFromRequest } from "@/server/auth";
import type { NextRequest } from "next/server";

export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export async function requireAdminApi(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user) throw Errors.unauthorized();
  if (user.role !== "ADMIN") throw Errors.forbidden("Akses ditolak.");
  return user;
}
