import Link from "next/link";
import { Zap } from "lucide-react";
import { settingsService } from "@/services/settings.service";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await settingsService.getSiteBranding();

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-8">
      <Link
        href="/"
        className="mb-8 flex flex-col items-center gap-3 text-center font-semibold tracking-tight"
      >
        <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-md ring-1 ring-black/5">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-12 w-12 object-contain"
            />
          ) : (
            <Zap className="h-5 w-5" />
          )}
        </span>
        <span className="text-xl">{branding.name}</span>
        {branding.tagline && (
          <span className="max-w-xs text-balance text-xs font-normal text-muted-foreground">
            {branding.tagline}
          </span>
        )}
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}