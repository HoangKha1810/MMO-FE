import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Box, Download, Package, ShoppingCart, Tag } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { ResourceDetailActions } from '@/components/resources/resource-detail-actions';
import { Badge } from '@/components/ui/badge';
import { rewriteGameAccountPriceMentions } from '@/lib/game-account-pricing';
import { getGameAccountThumbnailUrl } from '@/lib/game-account-media';
import { getResourceDetail } from '@/lib/legacy-modules';
import { hideProviderBranding } from '@/lib/provider-branding';
import { isRandom1kProviderLike } from '@/lib/random1k';
import { cleanResourceHtml } from '@/lib/resource-content';
import { listResourceReviews } from '@/lib/resource-actions';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resourceId = Number(id);
  if (!Number.isFinite(resourceId) || resourceId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const [data, reviews] = await Promise.all([
    getResourceDetail(resourceId, raw.id),
    listResourceReviews(resourceId),
  ]);
  if (!data) notFound();

  const { resource, related, orders } = data;
  const thumbnail = getGameAccountThumbnailUrl({
    title: resource.title,
    category: resource.category,
    categoryName: resource.category_name,
    tags: resource.tags,
    description: resource.description,
    customBadge: resource.custom_badge,
    primary: resource.thumbnail,
    fallback: resource.category_image,
  });
  const price = toNumber(resource.price);
  const sourcePrice = toNumber(resource.original_price);
  const shouldRewriteApiPrices =
    isRandom1kProviderLike({ name: resource.provider_name, api_url: resource.provider_api_url }) ||
    String(resource.tags || '').toLowerCase().includes('api-account');
  const title = shouldRewriteApiPrices
    ? rewriteGameAccountPriceMentions(hideProviderBranding(resource.title, `Sản phẩm #${resourceId}`), { sourcePrice, displayPrice: price })
    : hideProviderBranding(resource.title, `Sản phẩm #${resourceId}`);
  const descriptionHtml = shouldRewriteApiPrices
    ? rewriteGameAccountPriceMentions(cleanResourceHtml(resource.description, 'Tài nguyên MMO đang được bán trong hệ thống.'), { sourcePrice, displayPrice: price })
    : cleanResourceHtml(resource.description, 'Tài nguyên MMO đang được bán trong hệ thống.');
  const usesGameWallet = ['game', 'random'].includes(String(resource.api_account_kind || '').toLowerCase());

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <Link href="/user/resources" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Quay lại tài nguyên
        </Link>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-blue/10 to-emerald-500/10">
              {thumbnail ? (
                <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-24 w-24 text-brand-blue/35" />
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{hideProviderBranding(resource.category_name || resource.category, 'Resource')}</Badge>
              {resource.custom_badge ? <Badge>{hideProviderBranding(resource.custom_badge)}</Badge> : null}
              {resource.product_code ? <Badge variant="muted">{String(resource.product_code)}</Badge> : null}
            </div>
            <h1 className="mt-5 text-3xl font-black uppercase leading-[1.2] tracking-[-0.04em] text-slate-950 dark:text-white md:text-5xl md:leading-[1.16]">
              {title}
            </h1>
            <div
              className="resource-rich-content mt-4"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />

            <div className="mt-6 grid gap-3 min-[430px]:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <Tag className="h-4 w-4 text-brand-blue" />
                <div className="mt-2 font-mono text-xl font-black text-brand-blue">{formatCurrency(price)}</div>
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

            <div className="mt-6">
              <ResourceDetailActions
                resourceId={resourceId}
                price={price}
                stock={toNumber(resource.stock)}
                orders={orders as Array<Record<string, unknown>>}
                reviews={reviews}
                paymentWallet={usesGameWallet ? 'game' : 'main'}
                gameBalance={shell.game_balance}
                resourceTitle={String(resource.title || '')}
                resourceCategory={String(resource.category_name || resource.category || '')}
                resourceTags={String(resource.tags || '')}
              />
            </div>
          </div>
        </section>

        {related.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Tài nguyên liên quan</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {related.slice(0, 3).map((item) => (
                <Link key={String(item.id)} href={`/user/resources/${String(item.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                  <div className="text-xs font-black uppercase text-slate-900 dark:text-white">
                    {rewriteGameAccountPriceMentions(
                      hideProviderBranding(item.title, `Sản phẩm #${String(item.id)}`),
                      { sourcePrice: item.original_price, displayPrice: item.price }
                    )}
                  </div>
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
