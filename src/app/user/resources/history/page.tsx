import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { listResourceHistory } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ResourceHistoryPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const orders = await listResourceHistory(raw.id);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <Link href="/user/resources" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Tài nguyên
        </Link>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-blue">Resource history</div>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Lịch sử mua tài nguyên</h1>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-white/5">
              <tr>
                <th className="px-5 py-4">Tài nguyên</th>
                <th className="px-5 py-4">Tổng tiền</th>
                <th className="px-5 py-4">Download</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {orders.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-sm font-bold text-slate-400">Chưa có đơn tài nguyên.</td></tr>
              ) : orders.map((order) => (
                <tr key={String(order.id)} className="text-sm">
                  <td className="px-5 py-4">
                    <Link href={`/user/resources/${String(order.resource_id)}`} className="font-black text-slate-900 hover:text-brand-blue dark:text-white">
                      {String(order.title || `Resource #${order.resource_id}`)}
                    </Link>
                    <div className="mt-1 text-[10px] font-bold uppercase text-slate-400">{String(order.product_code || '')}</div>
                  </td>
                  <td className="px-5 py-4 font-mono font-black text-brand-blue">{formatCurrency(toNumber(order.total_price))}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <Download className="h-4 w-4" /> {toNumber(order.download_count)} / {toNumber(order.max_downloads)}
                    </span>
                  </td>
                  <td className="px-5 py-4">{String(order.status)}</td>
                  <td className="px-5 py-4 text-slate-400">{new Date(String(order.created_at)).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
