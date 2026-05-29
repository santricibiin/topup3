import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { settingsService } from "@/services/settings.service";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata = { title: "Lupa Password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const waotp = await settingsService.getWaOtpConfig();
  if (!waotp.enabled) {
    redirect("/login");
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lupa password?</CardTitle>
        <CardDescription>
          Kami kirim kode reset ke WhatsApp yang terdaftar pada akunmu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
