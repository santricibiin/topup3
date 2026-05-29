import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { getCurrentUser } from "@/server/auth";
import { depositService } from "@/services/deposit.service";
import { settingsService } from "@/services/settings.service";
import { DepositDetail } from "@/features/deposit/components/deposit-detail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps) {
  return { title: `Deposit ${params.id.slice(0, 8)}` };
}

export default async function DepositDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [deposit, cfg] = await Promise.all([
    depositService.getById(
      params.id,
      user.role === "ADMIN" ? undefined : user.id,
    ),
    settingsService.getDepositConfig(),
  ]);

  if (!deposit) notFound();

  const isAdminView = user.role === "ADMIN" && deposit.userId !== user.id;

  return (
    <>
      <Navbar />
      <main className="container max-w-2xl flex-1 py-6 md:py-10">
        <div className="space-y-5">
          <Button asChild variant="ghost" size="sm" className="-ml-3 h-8 text-muted-foreground">
            <Link href={isAdminView ? "/admin/deposits" : "/deposit"}>
              <ChevronLeft className="h-4 w-4" />
              {isAdminView ? "Kembali ke admin" : "Riwayat deposit"}
            </Link>
          </Button>

          <DepositDetail
            danaOwnerName={cfg.danaOwnerName}
            initial={{
              id: deposit.id,
              amount: deposit.amount.toString(),
              uniqueCode: deposit.uniqueCode,
              totalAmount: deposit.totalAmount.toString(),
              status: deposit.status,
              qrisPayload: deposit.qrisPayload,
              expiresAt: deposit.expiresAt.toISOString(),
              paidAt: deposit.paidAt?.toISOString() ?? null,
              createdAt: deposit.createdAt.toISOString(),
            }}
          />
        </div>
      </main>
    </>
  );
}
