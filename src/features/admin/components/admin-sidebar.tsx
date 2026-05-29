"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ListChecks,
  Users,
  Plug,
  Settings,
  Wallet,
  Database,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSidebar } from "./sidebar-context";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FullscreenToggle } from "@/components/layout/fullscreen-toggle";
import { AdminLogoutButton } from "./admin-logout-button";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Produk", icon: Package },
  { href: "/admin/transactions", label: "Transaksi", icon: ListChecks },
  { href: "/admin/deposits", label: "Deposit", icon: Wallet },
  { href: "/admin/users", label: "Pengguna", icon: Users },
  { href: "/admin/provider", label: "Provider", icon: Plug },
  { href: "/admin/backup", label: "Backup", icon: Database },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
] as const;

interface Props {
  user: { username: string; email: string };
  branding: { name: string; tagline: string; logoUrl: string };
}

export function AdminSidebar({ user, branding }: Props) {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useAdminSidebar();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Tutup menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/60 bg-card/95 backdrop-blur transition-[width,transform] duration-200",
          collapsed ? "lg:w-16" : "lg:w-64",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border/60",
            collapsed ? "lg:justify-center lg:px-0" : "gap-2 px-3",
          )}
        >
          {/* Saat collapsed: hanya tombol toggle (yg menampilkan icon P sekaligus berfungsi expand). */}
          {collapsed ? (
            <button
              type="button"
              onClick={toggle}
              className="hidden h-10 w-10 place-items-center overflow-hidden rounded-md bg-primary text-primary-foreground transition-colors hover:opacity-90 lg:grid"
              aria-label="Buka sidebar"
              title="Buka sidebar"
            >
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={branding.name}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          ) : (
            <>
              <Link
                href="/admin"
                className="flex flex-1 items-center gap-2 overflow-hidden px-2"
                onClick={() => setMobileOpen(false)}
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md bg-primary text-primary-foreground">
                  {branding.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={branding.logoUrl}
                      alt={branding.name}
                      className="h-8 w-8 object-contain"
                    />
                  ) : (
                    <span className="font-display text-sm font-bold">
                      {branding.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="overflow-hidden">
                  <div className="font-display text-sm font-semibold leading-none">
                    {branding.name}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Admin Panel
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
                aria-label="Tutup menu"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggle}
                className="hidden h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted lg:grid"
                aria-label="Tutup sidebar"
                title="Tutup sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active = isActive(item.href, "exact" in item ? item.exact : false);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  collapsed && "lg:justify-center lg:px-2",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-2">
          <div className={cn("mb-2 rounded-md bg-muted/50 px-3 py-2", collapsed && "lg:hidden")}>
            <div className="truncate text-sm font-medium">{user.username}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>

          {/* Tools row: theme + fullscreen */}
          <div
            className={cn(
              "mb-2 flex items-center gap-1 rounded-md",
              collapsed ? "lg:flex-col lg:gap-1" : "px-1",
            )}
          >
            <ThemeToggle />
            <FullscreenToggle />
          </div>

          <Link
            href="/"
            title={collapsed ? "Kembali ke situs" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed && "lg:justify-center lg:px-2",
            )}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Kembali ke situs</span>
          </Link>
          <AdminLogoutButton collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

export function AdminTopbar({ user, branding }: Props) {
  const { setMobileOpen } = useAdminSidebar();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur md:px-6 lg:hidden">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-md border border-border hover:bg-muted"
        aria-label="Buka menu"
      >
        <Menu className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-md bg-primary text-primary-foreground">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-7 w-7 object-contain"
            />
          ) : (
            <span className="font-display text-xs font-bold">
              {branding.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="font-display text-sm font-semibold">
          {branding.name} Admin
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
          {user.username}
        </span>
        <FullscreenToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AdminMain({ children }: { children: React.ReactNode }) {
  const { collapsed } = useAdminSidebar();
  return (
    <div
      className={cn(
        "transition-[padding] duration-200",
        collapsed ? "lg:pl-16" : "lg:pl-64",
      )}
    >
      {children}
    </div>
  );
}
