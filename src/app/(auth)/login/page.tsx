import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";
import { settingsService } from "@/services/settings.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const waotp = await settingsService.getWaOtpConfig();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk ke akun</CardTitle>
        <CardDescription>
          Gunakan email atau username yang sudah terdaftar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LoginForm showForgotLink={waotp.enabled} />
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Daftar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
