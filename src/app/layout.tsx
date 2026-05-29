import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { IconifyBootstrap } from "@/components/providers/iconify-bootstrap";
import { BottomNav } from "@/components/layout/bottom-nav";
import { getCurrentUser } from "@/server/auth";
import { settingsService } from "@/services/settings.service";
import { generateThemeCSS } from "@/lib/theme-presets";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e14" },
  ],
};

// Generate metadata dinamis dari settings (nama, tagline, logo → favicon).
export async function generateMetadata(): Promise<Metadata> {
  const branding = await settingsService.getSiteBranding().catch(() => ({
    name: "PTopup",
    tagline: "Topup PPOB & Game — cepat, aman, anti-ribet.",
    logoUrl: "",
    theme: "emerald",
  }));

  const icons = branding.logoUrl
    ? {
        icon: [{ url: branding.logoUrl }],
        shortcut: [{ url: branding.logoUrl }],
        apple: [{ url: branding.logoUrl }],
      }
    : undefined;

  return {
    title: {
      default: `${branding.name} — ${branding.tagline || "Topup PPOB & Game"}`,
      template: `%s · ${branding.name}`,
    },
    description: branding.tagline || "Topup PPOB, pulsa, dan game cepat, aman, anti-ribet.",
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    icons,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, branding] = await Promise.all([
    getCurrentUser(),
    settingsService.getSiteBranding(),
  ]);
  const themeCss = generateThemeCSS(branding.theme);

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <style id="ptopup-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body
        className={cn(
          "flex min-h-screen flex-col font-sans antialiased",
          sans.variable,
          mono.variable,
          user && "pb-16 md:pb-0",
        )}
      >
        <ThemeProvider>
          <IconifyBootstrap />
          {children}
          {user && <BottomNav isAdmin={user.role === "ADMIN"} />}
          <Toaster
            position="top-right"
            theme="system"
            toastOptions={{ className: "rounded-lg" }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
