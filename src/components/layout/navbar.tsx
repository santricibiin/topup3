import Link from "next/link";
import { Zap } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { FullscreenToggle } from "./fullscreen-toggle";
import { ProfileDropdown } from "./profile-dropdown";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth";
import { settingsService } from "@/services/settings.service";

export async function Navbar() {
  const [user, branding] = await Promise.all([
    getCurrentUser(),
    settingsService.getSiteBranding(),
  ]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-9 w-9 shrink-0 rounded-md object-contain"
            />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </span>
          )}
          <span>{branding.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {user && (
            <>
              <Link href="/topup" className="hover:text-foreground">Topup</Link>
              <Link href="/deposit" className="hover:text-foreground">Deposit</Link>
              <Link href="/transactions" className="hover:text-foreground">Riwayat</Link>
            </>
          )}
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="font-medium text-primary hover:text-primary/80">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <FullscreenToggle />
          <ThemeToggle />
          {user ? (
            <ProfileDropdown
              user={{
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                role: user.role,
              }}
              isAdmin={user.role === "ADMIN"}
            />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Masuk</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Daftar</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}