import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Box, Download, Package, ShoppingCart, Tag } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { getResourceDetail } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resourceId = Number(id);
  if (!Number.isFinite(resourceId) || resourceId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const data = await getResourceDetail(resourceId, raw.id);
  if (!data) notFound();

  const { resource, related, orders } = data;
  const thumbnail = buildLegacyAssetUrl(String(resource.thumbnail || ''));

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <Link href="/user/resources" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Quay lại tài nguyên
        </Link>

        <section className="grid gap-6 lg:grid-cols-[460px_1fr]">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-blue/10 to-emerald-500/10">
              {thumbnail ? (
                <img src={thumbnail} alt={String(resource.title)} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-24 w-24 text-brand-blue/35" />
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{String(resource.category_name || resource.category || 'Resource')}</Badge>
              {resource.custom_badge ? <Badge>{String(resource.custom_badge)}</Badge> : null}
              {resource.product_code ? <Badge variant="muted">{String(resource.product_code)}</Badge> : null}
            </div>
            <h1 className="mt-5 text-3xl font-black uppercase leading-tight tracking-[-0.05em] text-slate-950 dark:text-white md:text-5xl">
              {String(resource.title)}
            </h1>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-300">
              {String(resource.description || 'Tài nguyên MMO đang được bán trong hệ thống.')}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <Tag className="h-4 w-4 text-brand-blue" />
                <div className="mt-2 font-mono text-xl font-black text-brand-blue">{formatCurrency(toNumber(resource.price))}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Giá</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <Box className="h-4 w-4 text-emerald-500" />
                <div className="mt-2 text-xl font-black text-slate-950 dark:text-white">{toNumber(resource.stock)}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kho</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <Download className="h-4 w-4 text-orange-500" />
                <div className="mt-2 text-xl font-black text-slate-950 dark:text-white">{toNumber(resource.sold_count)}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đã bán</div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={toNumber(resource.stock) <= 0}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Mua / thêm giỏ
              </Button>
              <Link href="/user/resources/history" className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase dark:border-white/10">
                Lịch sử mua
              </Link>
            </div>
          </div>
        </section>

        {orders.length > 0 ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Bạn đã mua tài nguyên này</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {orders.map((order) => (
                <div key={String(order.id)} className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/5">
                  <div className="font-black text-slate-900 dark:text-white">Order #{String(order.id)}</div>
                  <div className="mt-1 text-slate-500">{formatCurrency(toNumber(order.total_price))} · {String(order.status)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Tài nguyên liên quan</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {related.slice(0, 3).map((item) => (
                <Link key={String(item.id)} href={`/user/resources/${String(item.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                  <div className="text-xs font-black uppercase text-slate-900 dark:text-white">{String(item.title)}</div>
                  <div className="mt-2 font-mono text-sm font-black text-brand-blue">{formatCurrency(toNumber(item.price))}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
