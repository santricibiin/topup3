import { MessageCircle, Smartphone, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WaOtpSettingsForm } from "@/features/admin/components/waotp-settings-form";
import { WaSessionPanel } from "@/features/admin/components/wa-session-panel";

export const metadata = { title: "Admin · Konfigurasi OTP" };
export const dynamic = "force-dynamic";

export default function AdminWaOtpPage() {
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
          <MessageCircle className="h-6 w-6 text-primary md:h-7 md:w-7" />
          Konfigurasi OTP
        </h1>
        <p className="text-sm text-muted-foreground">
          Gateway WhatsApp untuk verifikasi nomor, reset password, dan login OTP.
          Default off — aktifkan setelah set URL & API key.
        </p>
      </div>

      <div className="space-y-6">
        {/* SECTION: WA Session */}
        <Card>
          <SectionHeader
            icon={Smartphone}
            title="Sesi WhatsApp"
            description="Pairing perangkat WhatsApp via QR code. Sesi tersimpan di server, gak perlu scan ulang setelah restart."
          />
          <CardContent className="p-5 md:p-6">
            <WaSessionPanel />
          </CardContent>
        </Card>

        {/* SECTION: WAOTP Settings */}
        <Card>
          <SectionHeader
            icon={Settings2}
            title="Pengaturan Gateway"
            description="URL worker, API key, dan template pesan per purpose (verify phone, reset password, register, login, confirm transaction)."
          />
          <CardContent className="p-5 md:p-6">
            <WaOtpSettingsForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof MessageCircle;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4 md:px-6">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold tracking-tight">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
