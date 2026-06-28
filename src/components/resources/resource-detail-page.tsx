import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Box, Download, Package, Tag } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { ResourceContactAdminMode } from '@/components/resources/resource-contact-admin-mode';
import { ResourceDetailActions } from '@/components/resources/resource-detail-actions';
import { Badge } from '@/components/ui/badge';
import { rewriteGameAccountPriceMentions } from '@/lib/game-account-pricing';
import { getGameAccountThumbnailUrl } from '@/lib/game-account-media';
import { getResourceDetail, type ResourceCollection } from '@/lib/legacy-modules';
import { getLegacySettingsMap, getVatPercent, isResourcesContactAdminMode } from '@/lib/legacy-settings';
import { hideProviderBranding } from '@/lib/provider-branding';
import { isRandom1kProviderLike } from '@/lib/random1k';
import { listResourceReviews } from '@/lib/resource-actions';
import { cleanResourceHtml } from '@/lib/resource-content';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

interface ResourceDetailPageProps {
  id: string;
  collection?: ResourceCollection | 'resources';
}

const collectionCopy = {
  resources: {
    basePath: '/user/resources',
    backLabel: 'Quay lại tài nguyên',
    fallbackDescription: 'Tài nguyên MMO đang được bán trong hệ thống.',
    relatedTitle: 'Tài nguyên liên quan',
    historyHref: '/user/resources/history',
    purchaseErrorLabel: 'Không thể mua tài nguyên',
  },
  'game-accounts': {
    basePath: '/user/game-accounts',
    backLabel: 'Quay lại thuê tài khoản game 99 năm',
    fallbackDescription: 'Tài khoản game thuê 99 năm từ API đang được xử lý tự động trên hệ thống.',
    relatedTitle: 'Tài khoản game thuê 99 năm liên quan',
    historyHref: '/user/resources/history',
    purchaseErrorLabel: 'Không thể thuê tài khoản game',
  },
  'random-game-accounts': {
    basePath: '/user/random-game-accounts',
    backLabel: 'Quay lại random thuê tài khoản game 99 năm',
    fallbackDescription: 'Sản phẩm random thuê tài khoản game 99 năm đang được xử lý tự động trên hệ thống.',
    relatedTitle: 'Random thuê tài khoản game 99 năm liên quan',
    historyHref: '/user/resources/history',
    purchaseErrorLabel: 'Không thể thuê random tài khoản game',
  },
} satisfies Record<ResourceCollection | 'resources', {
  basePath: string;
  backLabel: string;
  fallbackDescription: string;
  relatedTitle: string;
  historyHref: string;
  purchaseErrorLabel: string;
}>;

function getResourceCollection(resource: Record<string, unknown>): ResourceCollection | 'resources' {
  const apiKind = String(resource.api_account_kind || '').trim().toLowerCase();
  if (apiKind === 'game') return 'game-accounts';
  if (apiKind === 'random') return 'random-game-accounts';
  return 'resources';
}

function isCollectionMatch(resource: Record<string, unknown>, collection: ResourceCollection | 'resources') {
  return collection === 'resources' || getResourceCollection(resource) === collection;
}

function buildResourceDetailHref(resource: Record<string, unknown>, fallbackCollection: ResourceCollection | 'resources' = 'resources') {
  const id = String(resource.id || '');
  const collection = getResourceCollection(resource);
  const copy = collectionCopy[collection] || collectionCopy[fallbackCollection];
  return `${copy.basePath}/${id}`;
}

export async function ResourceDetailPage({ id, collection = 'resources' }: ResourceDetailPageProps) {
  const resourceId = Number(id);
  if (!Number.isFinite(resourceId) || resourceId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const [data, reviews, settings] = await Promise.all([
    getResourceDetail(resourceId, raw.id),
    listResourceReviews(resourceId),
    getLegacySettingsMap(),
  ]);
  const vatPercent = getVatPercent(settings);
  if (!data) notFound();

  const { resource, related, orders } = data;
  if (!isCollectionMatch(resource, collection)) notFound();

  const actualCollection = getResourceCollection(resource);
  const copy = collectionCopy[actualCollection];
  const isGameResource = actualCollection !== 'resources';
  if (!isGameResource && isResourcesContactAdminMode(settings)) {
    return <ResourceContactAdminMode user={shell} resourceTitle={hideProviderBranding(resource.title, `Sản phẩm #${resourceId}`)} />;
  }

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
  const displayPrice = Math.round(price * (1 + vatPercent / 100));
  const sourcePrice = toNumber(resource.original_price);
  const shouldRewriteApiPrices =
    isRandom1kProviderLike({ name: resource.provider_name, api_url: resource.provider_api_url }) ||
    String(resource.tags || '').toLowerCase().includes('api-account') ||
    isGameResource;
  const title = shouldRewriteApiPrices
    ? rewriteGameAccountPriceMentions(hideProviderBranding(resource.title, `Sản phẩm #${resourceId}`), { sourcePrice, displayPrice })
    : hideProviderBranding(resource.title, `Sản phẩm #${resourceId}`);
  const descriptionHtml = shouldRewriteApiPrices
    ? rewriteGameAccountPriceMentions(cleanResourceHtml(resource.description, copy.fallbackDescription), { sourcePrice, displayPrice })
    : cleanResourceHtml(resource.description, copy.fallbackDescription);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <Link href={copy.basePath} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          {copy.backLabel}
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
              {isGameResource ? <Badge variant="success">Ví game</Badge> : null}
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
                <div className="mt-2 font-mono text-xl font-black text-brand-blue">{formatCurrency(displayPrice)}</div>
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
                vatPercent={vatPercent}
                stock={toNumber(resource.stock)}
                orders={orders as Array<Record<string, unknown>>}
                reviews={reviews}
                paymentWallet={isGameResource ? 'game' : 'main'}
                gameBalance={shell.game_balance}
                resourceTitle={String(resource.title || '')}
                resourceCategory={String(resource.category_name || resource.category || '')}
                resourceTags={String(resource.tags || '')}
                historyHref={copy.historyHref}
                purchaseErrorLabel={copy.purchaseErrorLabel}
              />
            </div>
          </div>
        </section>

        {related.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">{copy.relatedTitle}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {related.slice(0, 3).map((item) => (
                <Link key={String(item.id)} href={buildResourceDetailHref(item, actualCollection)} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                  <div className="text-xs font-black uppercase text-slate-900 dark:text-white">
                    {rewriteGameAccountPriceMentions(
                      hideProviderBranding(item.title, `Sản phẩm #${String(item.id)}`),
                      { sourcePrice: item.original_price, displayPrice: Math.round(toNumber(item.price) * (1 + vatPercent / 100)) }
                    )}
                  </div>
                  <div className="mt-2 font-mono text-sm font-black text-brand-blue">{formatCurrency(Math.round(toNumber(item.price) * (1 + vatPercent / 100)))}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
