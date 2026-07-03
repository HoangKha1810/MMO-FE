import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Package, ShieldCheck, Star, Tag } from 'lucide-react';
import { GameMarketGallery } from '@/components/game-market/game-market-gallery';
import { AppShell } from '@/components/layout/app-shell';
import { GameMarketDetailActions } from '@/components/game-market/game-market-detail-actions';
import { getGameMarketCategoryLabel } from '@/lib/game-market-config';
import { getGameMarketDetail } from '@/lib/game-market-actions';
import { getGameMarketGalleryUrls } from '@/lib/game-market-media';
import { formatCurrency, timeAgo, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function isSellerOnline(lastActivity: unknown) {
  const value = String(lastActivity || '').trim();
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= 70 * 1000;
}

export default async function GameMarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId) || itemId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const data = await getGameMarketDetail(itemId, raw.id);
  if (!data) notFound();

  const { item, related, myOrders } = data;
  const galleryImages = getGameMarketGalleryUrls({
    thumbnail: item.thumbnail,
    images: item.images,
  });
  const sellerOnline = isSellerOnline(item.seller_last_activity);
  const sellerPresence = sellerOnline
    ? 'Đang online'
    : String(item.seller_last_activity || '').trim()
      ? `Hoạt động ${timeAgo(String(item.seller_last_activity))}`
      : 'Ít hoạt động gần đây';

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <Link href="/user/game-market" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Quay lại trao đổi game
        </Link>

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
            {galleryImages.length > 0 ? (
              <GameMarketGallery images={galleryImages} title={String(item.title)} />
            ) : (
              <div className="mb-6 flex aspect-[16/8] items-center justify-center rounded-[1.6rem] border border-dashed border-slate-300 bg-[radial-gradient(circle_at_top,#2563eb22,transparent_58%),linear-gradient(135deg,#0f172a,#111827)] text-[11px] font-black uppercase tracking-[0.24em] text-slate-300 dark:border-white/10">
                Bài đăng chưa có ảnh minh họa
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-blue">
                {getGameMarketCategoryLabel(String(item.category || ''))}
              </span>
              {String(item.badge || '') ? (
                <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: String(item.badge_color || '#2563eb') }}>
                  {String(item.badge)}
                </span>
              ) : null}
              {item.is_pinned ? <span className="rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Ghim</span> : null}
            </div>
            <h1 className="mt-5 text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white md:text-5xl">{String(item.title)}</h1>
            <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-8 text-slate-500 dark:text-slate-400">{String(item.description || '')}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <Tag className="h-4 w-4 text-brand-blue" />
                <div className="mt-2 text-xl font-black text-brand-blue">{formatCurrency(toNumber(item.price))}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Giá trao đổi</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <Package className="h-4 w-4 text-emerald-500" />
                <div className="mt-2 text-xl font-black text-slate-950 dark:text-white">{toNumber(item.stock)}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Số lượng</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <ShieldCheck className="h-4 w-4 text-orange-500" />
                <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{String(item.delivery_method || 'manual')}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <Star className="h-4 w-4 text-amber-500" />
                <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{Number(item.average_rating || 0).toFixed(1)}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rating</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Người đăng</div>
                <div className="mt-3 text-lg font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">{String(item.seller_username || `User #${item.seller_id}`)}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{String(item.seller_rank || 'Member')}</div>
                <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                  sellerOnline
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${sellerOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
                  {sellerPresence}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Thông số nhanh</div>
                <div className="mt-3 grid gap-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                  <div>Rank: {String(item.rank || '—')}</div>
                  <div>Skins: {String(item.skins || '—')}</div>
                  <div>Champs: {String(item.champs || '—')}</div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Thao tác</div>
              <div className="mt-4">
                <GameMarketDetailActions
                  itemId={itemId}
                  itemPrice={toNumber(item.price)}
                  sellerId={Number(item.seller_id || 0)}
                  sellerUsername={String(item.seller_username || '')}
                  itemTitle={String(item.title || '')}
                  isOwner={Number(item.seller_id) === raw.id}
                  status={String(item.status || '')}
                  orders={myOrders}
                  gameBalance={shell.game_balance}
                />
              </div>
            </div>

            {String(item.account_details || '').trim() ? (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                  Thông tin bàn giao mẫu
                </div>
                <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                  {String(item.account_details).slice(0, 400)}
                </p>
              </div>
            ) : null}
          </aside>
        </section>

        {related.length > 0 ? (
          <section className="space-y-4">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Bài trao đổi liên quan</div>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((relatedItem) => (
                <Link key={String(relatedItem.id)} href={`/user/game-market/${String(relatedItem.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-blue/30 dark:border-white/10 dark:bg-slate-900">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {getGameMarketCategoryLabel(String(relatedItem.category || ''))}
                  </div>
                  <div className="mt-2 text-lg font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">{String(relatedItem.title)}</div>
                  <div className="mt-3 font-mono text-sm font-black text-brand-blue">{formatCurrency(toNumber(relatedItem.price))}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
