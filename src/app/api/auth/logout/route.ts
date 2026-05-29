import { cookies } from "next/headers";
import { apiHandler, ok } from "@/server/api-handler";
import { SESSION_COOKIE, clearSessionCookie } from "@/server/auth";
import { authService } from "@/services/auth.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async () => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await authService.logout(token);
  clearSessionCookie();
  return ok({ ok: true });
});
