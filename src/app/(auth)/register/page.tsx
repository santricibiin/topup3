import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { settingsService } from "@/services/settings.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Daftar" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const waotp = await settingsService.getWaOtpConfig();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat akun baru</CardTitle>
        <CardDescription>
          {waotp.enabled
            ? "Verifikasi nomor lewat WhatsApp untuk keamanan akun."
            : "Gratis. Cukup beberapa detik dan kamu sudah bisa transaksi."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RegisterForm requireOtp={waotp.enabled} />
        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
