import Link from 'next/link';
import { BadgeCheck, Pin, ShoppingBag, WandSparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { listGameMarketItems } from '@/lib/game-market-actions';
import { safeRows } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function UserGameMarketPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const [items, myOrders] = await Promise.all([
    listGameMarketItems(24),
    safeRows(`
      SELECT o.*, i.title AS item_title
      FROM game_market_orders o
      LEFT JOIN game_market_items i ON i.id = o.item_id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC
      LIMIT 12
    `, raw.id),
  ]);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-blue">Game Market</div>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
            Chợ game
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Listing, chi tiết, mua hàng, rating và seller flow được gom lại thành một marketplace dễ dùng hơn.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/user/game-market/sell" className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-black uppercase text-white">
              <WandSparkles className="h-4 w-4" />
              Thêm sản phẩm
            </Link>
            <Link href="/user/seller/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
              Seller Center
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link key={String(item.id)} href={`/user/game-market/${String(item.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-blue/35 dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{String(item.category || 'Game')}</div>
                <div className="flex gap-2">
                  {item.is_pinned ? <Pin className="h-4 w-4 text-orange-500" /> : null}
                  {String(item.badge || '') ? <BadgeCheck className="h-4 w-4 text-emerald-500" /> : null}
                </div>
              </div>
              <h2 className="mt-2 text-lg font-black uppercase text-slate-900 dark:text-white">{String(item.title)}</h2>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-lg font-black text-brand-blue">{formatCurrency(toNumber(item.price))}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-white/10">{String(item.status)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-slate-400">
                <span>Seller {String(item.seller_username || item.seller_id)}</span>
                <span>Stock {String(item.stock || 0)}</span>
              </div>
            </Link>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Đơn game của bạn</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {myOrders.length === 0 ? (
              <p className="text-sm text-slate-400">Bạn chưa có đơn game.</p>
            ) : myOrders.map((order) => (
              <Link key={String(order.id)} href={`/user/game-market/${String(order.item_id)}`} className="rounded-xl bg-slate-50 p-4 transition hover:border-brand-blue/30 dark:bg-white/5">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                  <ShoppingBag className="h-4 w-4 text-brand-blue" />
                  {String(order.item_title || order.item_id)}
                </div>
                <div className="mt-1 text-xs text-slate-400">{formatCurrency(toNumber(order.amount))} · {String(order.status)}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
