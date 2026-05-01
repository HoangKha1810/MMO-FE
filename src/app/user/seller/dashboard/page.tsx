import Link from 'next/link';
import { Banknote, Box, PackageCheck, ReceiptText } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { getGameMarketCategoryLabel } from '@/lib/game-market-config';
import { getSellerDashboard } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SellerDashboardPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const dashboard = await getSellerDashboard(raw.id);
  const pendingItems = dashboard.items.filter((item) => String(item.status || '') === 'pending').length;

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-[#f7f3ea] p-7 dark:border-white/10 dark:bg-[#101520]">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">Seller center</div>
              <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-slate-950 dark:text-white md:text-5xl">Dashboard người bán</h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                Quản lý bài đăng game, trạng thái chờ duyệt, đơn mua và yêu cầu rút tiền của shop trong một dashboard riêng.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/user/game-market/sell" className="rounded-xl bg-brand-blue px-4 py-2 text-xs font-black uppercase text-white">Đăng bài game</Link>
              <Link href="/user/seller/orders" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black uppercase text-white dark:bg-white dark:text-slate-950">Đơn hàng</Link>
              <Link href="/user/seller/withdraw" className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase text-white">Rút tiền</Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          {[
            { label: 'Sản phẩm', value: dashboard.items.length, icon: Box },
            { label: 'Đơn hàng', value: dashboard.orders.length, icon: ReceiptText },
            { label: 'Chờ duyệt', value: pendingItems, icon: Box },
            { label: 'Đã bán', value: dashboard.completedSales, icon: PackageCheck },
            { label: 'Doanh thu', value: formatCurrency(dashboard.revenue), icon: Banknote },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <stat.icon className="h-5 w-5 text-emerald-500" />
              <div className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{stat.value}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white">Sản phẩm đang bán</h2>
            <div className="mt-4 space-y-3">
              {dashboard.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 dark:border-white/10">Chưa có sản phẩm seller.</div>
              ) : dashboard.items.slice(0, 12).map((item) => (
                <div key={String(item.id)} className="rounded-2xl bg-slate-50 p-4 transition hover:border-brand-blue/30 dark:bg-white/[0.03]">
                  <div className="text-sm font-black uppercase text-slate-950 dark:text-white">{String(item.title)}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
                    <span>{getGameMarketCategoryLabel(String(item.category || ''))}</span>
                    <span>{formatCurrency(toNumber(item.price))}</span>
                    <span>
                      {String(item.status) === 'pending'
                        ? 'Chờ duyệt'
                        : String(item.status) === 'rejected'
                          ? 'Bị từ chối'
                          : String(item.status) === 'hidden'
                            ? 'Chưa công khai'
                            : String(item.status)}
                    </span>
                    <span>Stock {String(item.stock || 0)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/user/game-market/${String(item.id)}`}
                      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-brand-blue/25 hover:text-brand-blue dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                    >
                      Xem bài
                    </Link>
                    <Link
                      href={`/user/game-market/edit/${String(item.id)}`}
                      className="inline-flex items-center rounded-lg bg-brand-blue px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                    >
                      Sửa nội dung & giá
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white">Đơn mới</h2>
            <div className="mt-4 space-y-3">
              {dashboard.orders.slice(0, 10).map((order) => (
                <div key={String(order.id)} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.03]">
                  <div className="text-sm font-black text-slate-950 dark:text-white">#{String(order.id)} {String(order.item_title || 'Sản phẩm')}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">{formatCurrency(toNumber(order.amount))} · {String(order.status)}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
