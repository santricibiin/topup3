import {
  Settings as SettingsIcon,
  Globe,
  LayoutGrid,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { settingsService, SETTING_KEYS } from "@/services/settings.service";
import { categorySettingsService } from "@/services/category-settings.service";
import { SiteSettingsForm } from "@/features/admin/components/site-settings-form";
import { CategorySettingsForm } from "@/features/admin/components/category-settings-form";

export const metadata = { title: "Admin · Pengaturan" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [branding, categories, iconSizeRaw, iconShapeRaw, groupedRaw] = await Promise.all([
    settingsService.getSiteBranding(),
    categorySettingsService.getAll(),
    settingsService.get(SETTING_KEYS.TOPUP_ICON_SIZE),
    settingsService.get(SETTING_KEYS.TOPUP_ICON_SHAPE),
    settingsService.get(SETTING_KEYS.TOPUP_GROUPED_LAYOUT),
  ]);
  const iconSize = Math.max(24, Math.min(96, Number(iconSizeRaw) || 56));
  const iconShape: "rounded" | "circle" =
    iconShapeRaw === "circle" ? "circle" : "rounded";
  const groupedLayout = groupedRaw === "true";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
          <SettingsIcon className="h-6 w-6 text-primary md:h-7 md:w-7" />
          Pengaturan
        </h1>
        <p className="text-sm text-muted-foreground">
          Konfigurasi identitas website yang ditampilkan ke pengguna.
        </p>
      </div>

      <div className="space-y-6">
        {/* SECTION: Branding */}
        <Card>
          <SectionHeader
            icon={Globe}
            title="Identitas Website"
            description="Nama, tagline, logo, dan warna tema yang dilihat pengguna."
          />
          <CardContent className="p-5 md:p-6">
            <SiteSettingsForm
              initial={{
                name: branding.name,
                tagline: branding.tagline,
                logoUrl: branding.logoUrl,
                theme: branding.theme,
              }}
            />
          </CardContent>
        </Card>

        {/* SECTION: Category Customization */}
        <Card>
          <SectionHeader
            icon={LayoutGrid}
            title="Kategori Topup"
            description="Atur tampilan kategori di halaman /topup &mdash; ukuran icon, label, badge, urutan, dan visibility."
          />
          <CardContent className="p-5 md:p-6">
            <CategorySettingsForm
              initialItems={categories.map((c) => ({
                category: c.category,
                label: c.label,
                iconName: c.iconName,
                gradient: c.gradient,
                badge: c.badge,
                hidden: c.hidden,
                sortOrder: c.sortOrder,
              }))}
              initialIconSize={iconSize}
              initialIconShape={iconShape}
              initialGroupedLayout={groupedLayout}
            />
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
  icon: typeof Globe;
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
