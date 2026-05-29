import { Plug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProviderManager } from "@/features/admin/components/provider-manager";

export const metadata = { title: "Admin · Provider" };
export const dynamic = "force-dynamic";

export default function AdminProviderPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
          <Plug className="h-6 w-6 text-primary md:h-7 md:w-7" />
          Provider
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola kredensial Digiflazz, cek saldo deposit, dan atur markup harga jual.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 md:p-6">
          <ProviderManager />
        </CardContent>
      </Card>
    </div>
  );
}
