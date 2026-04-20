import { AppShell } from '@/components/layout/app-shell';
import { listSellerOrders } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SellerOrdersPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const orders = await listSellerOrders(raw.id);

  return (
    <AppShell user={shell}>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
        <div className="mb-5">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">Seller orders</div>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">Đơn hàng game market</h1>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                {['ID', 'Sản phẩm', 'Buyer', 'Số tiền', 'Trạng thái', 'Ngày'].map((item) => <th key={item} className="border-b border-slate-100 px-3 py-3 dark:border-white/5">{item}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {orders.map((order) => (
                <tr key={String(order.id)} className="align-top">
                  <td className="px-3 py-4 font-black text-slate-950 dark:text-white">#{String(order.id)}</td>
                  <td className="px-3 py-4 font-bold text-slate-700 dark:text-slate-200">{String(order.item_title || order.item_id)}</td>
                  <td className="px-3 py-4 text-slate-500">{String(order.buyer_username || order.buyer_id)}</td>
                  <td className="px-3 py-4 font-black text-emerald-500">{formatCurrency(toNumber(order.amount))}</td>
                  <td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-white/10">{String(order.status)}</span></td>
                  <td className="px-3 py-4 text-slate-400">{new Date(String(order.created_at)).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
