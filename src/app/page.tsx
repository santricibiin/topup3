import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/topup" : "/login");
}
