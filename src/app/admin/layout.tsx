import { requireAdminPage } from "@/server/admin";
import { AdminSidebar, AdminTopbar, AdminMain } from "@/features/admin/components/admin-sidebar";
import { AdminSidebarProvider } from "@/features/admin/components/sidebar-context";
import { settingsService } from "@/services/settings.service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, branding] = await Promise.all([
    requireAdminPage(),
    settingsService.getSiteBranding(),
  ]);
  const u = { username: user.username, email: user.email };

  return (
    <AdminSidebarProvider>
      <div className="min-h-screen">
        <AdminSidebar user={u} branding={branding} />
        <AdminMain>
          <AdminTopbar user={u} branding={branding} />
          <main className="px-4 py-6 sm:px-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
            {children}
          </main>
        </AdminMain>
      </div>
    </AdminSidebarProvider>
  );
}
