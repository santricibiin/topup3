import { redirect } from "next/navigation";
import { User as UserIcon, Lock, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import { getCurrentUser } from "@/server/auth";
import { settingsService } from "@/services/settings.service";
import {
  ProfileForm,
  PasswordForm,
} from "@/features/profile/components/profile-form";
import { PhoneVerification } from "@/features/profile/components/phone-verification";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const waotp = await settingsService.getWaOtpConfig();

  return (
    <>
      <Navbar />
      <main className="container max-w-2xl flex-1 py-6 md:py-10">
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <UserIcon className="h-6 w-6 text-primary md:h-7 md:w-7" />
              Profile
            </h1>
            <p className="text-sm text-muted-foreground">
              Kelola data akun, foto profil, dan password.
            </p>
          </div>

          {/* Section: Profile data */}
          <Card>
            <SectionHeader
              icon={UserIcon}
              title="Data Akun"
              description="Username & email tidak bisa diubah. Edit nama, nomor HP, dan foto profil di sini."
            />
            <CardContent className="p-5 md:p-6">
              <ProfileForm
                initial={{
                  username: user.username,
                  email: user.email,
                  fullName: user.fullName ?? "",
                  phone: user.phone ?? "",
                  avatarUrl: user.avatarUrl ?? "",
                }}
              />
            </CardContent>
          </Card>

          {/* Section: Verifikasi WhatsApp */}
          {waotp.enabled && (
            <Card>
              <SectionHeader
                icon={MessageCircle}
                title="Verifikasi WhatsApp"
                description="Verifikasi nomor WA agar bisa reset password kalau lupa, dan untuk konfirmasi keamanan."
              />
              <CardContent className="p-5 md:p-6">
                <PhoneVerification
                  phone={user.phone ?? ""}
                  verified={Boolean(user.phoneVerified)}
                />
              </CardContent>
            </Card>
          )}

          {/* Section: Password */}
          <Card>
            <SectionHeader
              icon={Lock}
              title="Keamanan"
              description="Ganti password akunmu. Sesi lain akan tetap berlaku."
            />
            <CardContent className="p-5 md:p-6">
              <PasswordForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserIcon;
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
