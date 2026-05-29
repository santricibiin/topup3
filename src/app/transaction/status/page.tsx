import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface SearchProps {
  searchParams: { merchantOrderId?: string };
}

/**
 * Return URL dari Duitku.
 * Duitku biasanya append `?merchantOrderId=...&resultCode=...`.
 * Cukup redirect ke halaman detail transaksi user.
 */
export default function ReturnPage({ searchParams }: SearchProps) {
  const orderId = searchParams.merchantOrderId;
  if (orderId) redirect(`/transaction/${orderId}`);

  return (
    <>
      <Navbar />
      <main className="container flex min-h-[60vh] items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Pembayaran selesai diproses</CardTitle>
            <CardDescription>
              Cek status terbaru di riwayat transaksi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/transactions">Lihat riwayat</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
