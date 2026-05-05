import Link from 'next/link';
import { Boxes, Gamepad2, Package, Search, ShoppingCart, Shuffle, Sparkles, Store, type LucideIcon } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { listResources, type ResourceCollection } from '@/lib/legacy-modules';
import { syncGameAccountResourcesOnUserVisit } from '@/lib/mmo-provider';
import { hideProviderBranding } from '@/lib/provider-branding';
import { resourceHtmlToText } from '@/lib/resource-content';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

type ResourceRow = Record<string, unknown>;

interface ResourceCollectionPageProps {
  collection: ResourceCollection;
  search?: string;
  category?: string;
}

const collectionCopy = {
  'game-accounts': {
    basePath: '/user/game-accounts',
    eyebrow: 'Game Account API',
    title: 'Tài khoản game',
    description: 'Danh sách sản phẩm tài khoản game được đồng bộ trực tiếp từ API, hiển thị tồn kho, giá bán và trạng thái mua bằng số dư.',
    icon: Gamepad2,
    emptyTitle: 'Chưa có tài khoản game API',
    emptyDescription: 'Admin cần cấu hình provider API tài khoản game và chạy đồng bộ để sản phẩm xuất hiện trong module này.',
  },
  'random-game-accounts': {
    basePath: '/user/random-game-accounts',
    eyebrow: 'Random / Túi mù',
    title: 'Random tài khoản game',
    description: 'Kho sản phẩm quay, random và túi mù được tự động tách từ API, dùng cùng luồng mua tự động để nhận dữ liệu sau thanh toán.',
    icon: Shuffle,
    emptyTitle: 'Chưa có sản phẩm random tài khoản game',
    emptyDescription: 'Sau khi sync API, các sản phẩm có từ khóa quay, random hoặc túi mù sẽ được gom riêng tại đây.',
  },
} satisfies Record<ResourceCollection, {
  basePath: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}>;

function getFilterLabel(item: ResourceRow) {
  return hideProviderBranding(item.category_name || item.category || item.custom_badge, 'Tài khoản game');
}

function getProviderLabel(value: unknown) {
  const label = hideProviderBranding(value);
  return label === 'API' ? 'API tự động' : label || 'API tự động';
}

function buildHref(basePath: string, input: { search?: string; category?: string } = {}) {
  const params = new URLSearchParams();
  if (input.search?.trim()) params.set('search', input.search.trim());
  if (input.category?.trim()) params.set('category', input.category.trim());
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function ResourceCollectionPage({ collection, search = '', category = '' }: ResourceCollectionPageProps) {
  const { shell } = await getCurrentUserForShell();
  const copy = collectionCopy[collection];
  const Icon = copy.icon;
  const syncResult = await syncGameAccountResourcesOnUserVisit().catch(() => null);
  const [resources, categoryPool] = await Promise.all([
    listResources({ collection, search, category, limit: 120 }),
    listResources({ collection, search, limit: 120 }),
  ]);
  const categories = Array.from(new Set(categoryPool.map(getFilterLabel).filter(Boolean)));
  const totalStock = resources.reduce((sum, item) => sum + toNumber(item.stock, 0), 0);
  const totalSold = resources.reduce((sum, item) => sum + toNumber(item.sold_count, 0), 0);
  const emptyDescription = syncResult?.reason === 'missing-api-key'
    ? 'Hệ thống chưa đọc được API key. Hãy cấu hình GAME_ACCOUNT_API_KEY trong .env.local rồi restart server.'
    : 'Hệ thống đã tự đồng bộ khi bạn mở trang. Nếu vẫn chưa có sản phẩm, admin cần kiểm tra API key/provider hoặc dữ liệu API nguồn.';

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <PageHero
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          stats={[
            { label: 'Danh mục', value: String(categories.length), hint: 'Nhóm sản phẩm API', tone: 'blue' },
            { label: 'Sản phẩm', value: String(resources.length), hint: category ? 'Đang lọc theo nhóm' : 'Đang hiển thị', tone: 'emerald' },
            { label: 'Tồn kho', value: String(totalStock), hint: 'Số lượng có thể mua', tone: 'amber' },
            { label: 'Đã bán', value: String(totalSold), hint: 'Lượt mua ghi nhận', tone: 'violet' },
          ]}
          actions={
            <>
              <Badge variant="info" className="rounded-full px-3 py-1.5">
                <Icon className="h-3 w-3" />
                API tự động
              </Badge>
              <Badge variant="muted" className="rounded-full px-3 py-1.5">
                Mua tự động
              </Badge>
            </>
          }
        />

        <SectionPanel>
          <SectionHeader
            eyebrow="Catalog"
            title="Tìm nhanh sản phẩm"
            description="Lọc theo tên sản phẩm hoặc danh mục để chọn đúng tài khoản cần mua."
          />

          <form action={copy.basePath} className="mt-6 flex flex-col gap-3 xl:flex-row">
            <div className="relative max-w-2xl flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="search"
                defaultValue={search}
                placeholder="Tìm theo game, loại acc, mô tả..."
                className="field-elevated h-11 w-full rounded-[1rem] pl-11 pr-4 text-sm font-semibold outline-none dark:text-white"
              />
            </div>
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] bg-brand-blue px-5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.8)] transition hover:-translate-y-0.5"
            >
              <Search className="h-4 w-4" />
              Lọc
            </button>
          </form>

          {categories.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={buildHref(copy.basePath, { search })}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                  !category
                    ? 'border-brand-blue bg-brand-blue text-white shadow-[0_18px_40px_-26px_rgba(37,99,235,0.65)]'
                    : 'border-slate-200/80 bg-white/80 text-slate-500 hover:border-brand-blue/30 hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                }`}
              >
                Tất cả
              </Link>
              {categories.slice(0, 18).map((item) => (
                <Link
                  key={item}
                  href={buildHref(copy.basePath, { search, category: item })}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                    category === item
                      ? 'border-brand-blue bg-brand-blue text-white shadow-[0_18px_40px_-26px_rgba(37,99,235,0.65)]'
                      : 'border-slate-200/80 bg-white/80 text-slate-500 hover:border-brand-blue/30 hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                  }`}
                >
                  {item}
                </Link>
              ))}
            </div>
          ) : null}
        </SectionPanel>

        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Live Inventory"
            title="Danh sách sản phẩm API"
            description="Giá và tồn kho được lấy từ dữ liệu API đã đồng bộ, đơn mua sẽ tự động gọi API khi sản phẩm còn hàng."
            actions={
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted" className="rounded-full px-3 py-1.5">
                  <Boxes className="h-3 w-3" />
                  {resources.length} item
                </Badge>
                {category ? (
                  <Badge variant="info" className="rounded-full px-3 py-1.5">
                    Đang lọc: {category}
                  </Badge>
                ) : null}
                <Badge variant="muted" className="rounded-full px-3 py-1.5">
                  <Store className="h-3 w-3" />
                  API tự động
                </Badge>
              </div>
            }
          />

          {resources.length === 0 ? (
            <EmptyState
              title={copy.emptyTitle}
              description={emptyDescription || copy.emptyDescription}
              icon={<Package className="h-5 w-5" />}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {resources.map((resource) => {
                const thumbnail = buildLegacyAssetUrl(String(resource.thumbnail || resource.category_image || ''));
                const description = resourceHtmlToText(resource.description);
                const title = hideProviderBranding(resource.title, `Sản phẩm #${String(resource.id)}`);
                const stock = toNumber(resource.stock);

                return (
                  <article key={String(resource.id)} className="surface-card group rounded-[1.75rem] p-5 md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border border-brand-blue/15 bg-gradient-to-br from-brand-blue/15 via-cyan-500/10 to-emerald-500/10 text-brand-blue shadow-sm transition-transform duration-300 group-hover:scale-105">
                        {thumbnail ? (
                          <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
                        ) : (
                          <Icon className="h-7 w-7" />
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant="info" className="rounded-full px-3 py-1.5 text-[9px]">
                          {getFilterLabel(resource)}
                        </Badge>
                        <Badge variant="muted" className="rounded-full px-3 py-1.5 text-[9px]">
                          {getProviderLabel(resource.provider_name)}
                        </Badge>
                        <Badge variant={stock > 0 ? 'success' : 'warning'} className="rounded-full px-3 py-1.5 text-[9px]">
                          {stock > 0 ? 'Còn hàng' : 'Hết hàng'}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      <Link
                        href={`/user/resources/${String(resource.id)}`}
                        className="block text-lg font-black uppercase leading-tight tracking-[-0.04em] text-slate-950 transition hover:text-brand-blue dark:text-white"
                      >
                        {title}
                      </Link>
                      <p className="line-clamp-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                        {hideProviderBranding(description, 'Sản phẩm API đang mở bán tự động trên hệ thống.')}
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                        <div className="font-mono text-lg font-black text-brand-blue">{formatCurrency(toNumber(resource.price))}</div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Giá bán</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                        <div className="text-lg font-black text-slate-950 dark:text-white">{stock}</div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Tồn kho</div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-5 dark:border-white/10">
                      <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        <Sparkles className="h-3.5 w-3.5 text-brand-blue" />
                        Auto delivery
                      </div>
                      <Link
                        href={`/user/resources/${String(resource.id)}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {stock > 0 ? 'Mua' : 'Chi tiết'}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
