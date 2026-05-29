import { apiHandler, ok } from "@/server/api-handler";
import { Errors } from "@/lib/errors";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  return ok({
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    balance: user.balance?.amount.toString() ?? "0",
  });
});
