import Link from 'next/link';
import { BadgeCheck, Pin, ShoppingBag, ShieldCheck, WandSparkles } from 'lucide-react';
import { GameMarketSafetyPopup } from '@/components/game-market/game-market-safety-popup';
import { AppShell } from '@/components/layout/app-shell';
import {
  gameMarketCategories,
  getGameMarketCategoryLabel,
  getGameMarketCategoryMeta,
  normalizeGameMarketCategory,
} from '@/lib/game-market-config';
import {
  listGameMarketCategoryStats,
  listGameMarketItems,
  listSellerGameItems,
} from '@/lib/game-market-actions';
import { getGameMarketGalleryUrls } from '@/lib/game-market-media';
import { safeRows } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

const statusLabels: Record<string, string> = {
  pending: 'Chờ duyệt',
  selling: 'Đang bán',
  rejected: 'Bị từ chối',
  hidden: 'Chưa công khai',
  sold: 'Đã bán',
};

const tradingRules = [
  {
    title: 'Phí trung gian',
    items: [
      'Phí trung gian đối với tài khoản dưới 1 triệu là 50-100k.',
      'Tài khoản trên 1 triệu sẽ áp dụng mức phí 10% trên mỗi tài khoản.',
    ],
  },
  {
    title: 'Thu acc',
    items: [
      'Đối với acc dính thông tin: khách hàng đưa acc, hold 7 ngày, sau đó admin mới bank tiền.',
      'Đối với acc trắng thông tin hoặc drop mail: cần đưa toàn bộ mail và số điện thoại cho admin, không cần hold, check acc xong sẽ bank tiền luôn và giá sẽ cao hơn acc có thông tin.',
    ],
  },
  {
    title: 'Kỷ luật giao dịch',
    items: [
      'Những cá nhân cố tình giao dịch riêng có phát sinh vấn đề hoặc cố tình làm trái nội quy sẽ bị admin ban hoặc không xử lý hoàn toàn theo quy định.',
    ],
  },
];

export default async function UserGameMarketPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const { raw, shell } = await getCurrentUserForShell();
  const resolvedSearchParams = await searchParams;
  const activeCategory = resolvedSearchParams?.category
    ? normalizeGameMarketCategory(resolvedSearchParams.category)
    : 'all';

  const [items, myOrders, myListings, categoryStats] = await Promise.all([
    listGameMarketItems(24, activeCategory === 'all' ? undefined : activeCategory),
    safeRows(`
      SELECT o.*, i.title AS item_title
      FROM game_market_orders o
      LEFT JOIN game_market_items i ON i.id = o.item_id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC
      LIMIT 12
    `, raw.id),
    listSellerGameItems(raw.id, 8),
    listGameMarketCategoryStats(),
  ]);

  const categoryStatsMap = new Map(categoryStats.map((item) => [item.slug, item.total]));
  const categoryTabs = gameMarketCategories.map((item) => ({
    ...item,
    total: categoryStatsMap.get(item.slug) || 0,
  }));
  const pendingListings = myListings.filter((item) => String(item.status || '') === 'pending').length;
  const visibleCategoryMeta = activeCategory === 'all' ? null : getGameMarketCategoryMeta(activeCategory);

  return (
    <AppShell user={shell}>
      <GameMarketSafetyPopup />
      <div className="space-y-6">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:rounded-[2rem] sm:p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-blue">Game Market</div>
          <h1 className="mt-3 break-words text-2xl font-black uppercase leading-[1.2] tracking-[-0.02em] text-slate-900 dark:text-white sm:text-3xl sm:leading-[1.16]">
            Chợ mua bán game theo từng danh mục
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-8 tracking-[0.018em] text-slate-500 dark:text-slate-400">
            Đăng bài mua bán tài khoản game theo từng thể loại như Liên Quân Mobile, PUBG Mobile, Valorant và nhiều game khác. Mỗi bài đăng của user sẽ vào trạng thái chờ duyệt trước khi xuất hiện công khai.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/user/game-market/sell" className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-black uppercase text-white">
              <WandSparkles className="h-4 w-4" />
              Đăng bài mới
            </Link>
            <Link href="/user/seller/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
              Seller Center
            </Link>
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase text-emerald-600 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              {pendingListings} bài đang chờ duyệt
            </div>
          </div>
        </div>

        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">Nội quy giao dịch</div>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {tradingRules.map((rule) => (
              <div key={rule.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950 dark:text-white">{rule.title}</h2>
                <div className="mt-3 space-y-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                  {rule.items.map((item) => (
                    <p key={item}>- {item}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Danh mục game</div>
              <h2 className="mt-2 text-xl font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                {visibleCategoryMeta ? visibleCategoryMeta.label : 'Tất cả danh mục'}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                {visibleCategoryMeta
                  ? visibleCategoryMeta.description
                  : 'Lọc nhanh theo từng game để tìm đúng loại account và bài đăng bạn đang quan tâm.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/user/game-market"
                className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                  activeCategory === 'all'
                    ? 'border-brand-blue bg-brand-blue text-white'
                    : 'border-slate-200/80 bg-white/80 text-slate-500 hover:border-brand-blue/25 hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                }`}
              >
                Tất cả
              </Link>
              {categoryTabs.map((category) => (
                <Link
                  key={category.slug}
                  href={`/user/game-market?category=${category.slug}`}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                    activeCategory === category.slug
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-slate-200/80 bg-white/80 text-slate-500 hover:border-brand-blue/25 hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                  }`}
                >
                  {category.label} ({category.total})
                </Link>
              ))}
            </div>
          </div>
        </section>

        {items.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm font-semibold leading-8 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            Hiện chưa có bài đăng nào trong danh mục này. Bạn có thể chuyển danh mục khác hoặc tự đăng bài mới để bắt đầu giao dịch.
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const categoryMeta = getGameMarketCategoryMeta(String(item.category || ''));
              const previewImages = getGameMarketGalleryUrls({
                thumbnail: item.thumbnail,
                images: item.images,
              });
              return (
                <Link key={String(item.id)} href={`/user/game-market/${String(item.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-blue/35 dark:border-white/10 dark:bg-slate-900">
                  <div className="mb-4 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950/40">
                    {previewImages[0] ? (
                      <div className="relative aspect-[16/10]">
                        <img src={previewImages[0]} alt={String(item.title)} className="h-full w-full object-cover" />
                        {previewImages.length > 1 ? (
                          <div className="absolute bottom-3 right-3 rounded-full bg-slate-950/75 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                            +{previewImages.length - 1} ảnh
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex aspect-[16/10] items-center justify-center bg-[radial-gradient(circle_at_top,#2563eb22,transparent_60%),linear-gradient(135deg,#0f172a,#111827)] text-[11px] font-black uppercase tracking-[0.22em] text-slate-300">
                        Chưa có ảnh
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{categoryMeta.label}</div>
                    <div className="flex gap-2">
                      {item.is_pinned ? <Pin className="h-4 w-4 text-orange-500" /> : null}
                      {String(item.badge || '') ? <BadgeCheck className="h-4 w-4 text-emerald-500" /> : null}
                    </div>
                  </div>
                  <h2 className="mt-2 text-lg font-black uppercase text-slate-900 dark:text-white">{String(item.title)}</h2>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                    {String(item.description || '')}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-lg font-black text-brand-blue">{formatCurrency(toNumber(item.price))}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-white/10">
                      {statusLabels[String(item.status || '')] || String(item.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-slate-400">
                    <span>Seller {String(item.seller_username || item.seller_id)}</span>
                    <span>Stock {String(item.stock || 0)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Bài đăng của bạn</h2>
            <div className="mt-4 grid gap-3">
              {myListings.length === 0 ? (
                <p className="text-sm text-slate-400">Bạn chưa có bài đăng game nào.</p>
              ) : myListings.map((item) => {
                const previewImage = getGameMarketGalleryUrls({ thumbnail: item.thumbnail, images: item.images }, 1)[0];
                return (
                  <div key={String(item.id)} className="rounded-xl bg-slate-50 p-4 transition hover:border-brand-blue/30 dark:bg-white/5">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] bg-slate-200 dark:bg-slate-950/50">
                        {previewImage ? (
                          <img
                            src={previewImage}
                            alt={String(item.title || `Bài #${item.id}`)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">No image</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-black text-slate-900 dark:text-white">{String(item.title || `Bài #${item.id}`)}</div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                            String(item.status) === 'pending'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                              : String(item.status) === 'selling'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : String(item.status) === 'rejected'
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-300'
                                  : String(item.status) === 'hidden'
                                    ? 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                                  : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                          }`}>
                            {statusLabels[String(item.status || '')] || String(item.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
                          <span>{getGameMarketCategoryLabel(String(item.category || ''))}</span>
                          <span>{formatCurrency(toNumber(item.price))}</span>
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Đơn game của bạn</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
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
        </section>
      </div>
    </AppShell>
  );
}
