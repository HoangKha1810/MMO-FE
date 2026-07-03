import { AppShell } from '@/components/layout/app-shell';
import { SellerGameOrdersBoard } from '@/components/game-market/seller-game-orders-board';
import { listSellerOrders } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SellerOrdersPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const orders = await listSellerOrders(raw.id);

  return (
    <AppShell user={shell}>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
        <div className="mb-5">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">Đơn trao đổi</div>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">Đơn trao đổi game</h1>
        </div>
        <SellerGameOrdersBoard orders={orders} />
      </section>
    </AppShell>
  );
}
