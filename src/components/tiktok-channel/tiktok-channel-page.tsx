'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Heart,
  KeyRound,
  Loader2,
  Music,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHero, SectionHeader } from '@/components/ui/page-layout';
import { useSessionUser } from '@/hooks/use-session-user';
import { readJsonResponse } from '@/lib/client-api';
import { cn, formatCurrency, toNumber } from '@/lib/utils';

type TikTokChannelProduct = {
  id: number;
  provider_product_id: string;
  title: string;
  description?: string | null;
  niche?: string | null;
  follower_count: number;
  like_count: number;
  listed_price_vnd: number;
  sale_price_vnd: number;
  discount_percent: number;
  masked_username?: string | null;
  thumbnail_url?: string | null;
  photos?: string[];
  status: string;
};

type TikTokChannelOrder = {
  id: number;
  order_code: string;
  product_id: number;
  provider_product_id: string;
  provider_order_id?: string | null;
  product_title: string;
  niche?: string | null;
  follower_count: number;
  sale_price_vnd: number;
  status: string;
  credentials?: Record<string, unknown>;
  admin_note?: string | null;
  created_at?: string | null;
};

type Pagination = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

type NicheOption = {
  value: string;
  label: string;
  total: number;
};

const credentialLabels: Record<string, string> = {
  username: 'Username',
  password: 'Password',
  email: 'Email',
  emailPassword: 'Email password',
  twoFactor: '2FA',
  note: 'Ghi chú',
};

function normalizeProduct(input: Record<string, unknown>): TikTokChannelProduct {
  return {
    id: Math.trunc(toNumber(input.id, 0)),
    provider_product_id: String(input.provider_product_id || ''),
    title: String(input.title || ''),
    description: input.description == null ? null : String(input.description),
    niche: input.niche == null ? null : String(input.niche),
    follower_count: Math.trunc(toNumber(input.follower_count, 0)),
    like_count: Math.trunc(toNumber(input.like_count, 0)),
    listed_price_vnd: Math.round(toNumber(input.listed_price_vnd, 0)),
    sale_price_vnd: Math.round(toNumber(input.sale_price_vnd, 0)),
    discount_percent: toNumber(input.discount_percent, 0),
    masked_username: input.masked_username == null ? null : String(input.masked_username),
    thumbnail_url: input.thumbnail_url == null ? null : String(input.thumbnail_url),
    photos: Array.isArray(input.photos) ? input.photos.map(String).filter(Boolean) : [],
    status: String(input.status || 'active'),
  };
}

function normalizeOrder(input: Record<string, unknown>): TikTokChannelOrder {
  const credentials = input.credentials && typeof input.credentials === 'object'
    ? input.credentials as Record<string, unknown>
    : {};

  return {
    id: Math.trunc(toNumber(input.id, 0)),
    order_code: String(input.order_code || ''),
    product_id: Math.trunc(toNumber(input.product_id, 0)),
    provider_product_id: String(input.provider_product_id || ''),
    provider_order_id: input.provider_order_id == null ? null : String(input.provider_order_id),
    product_title: String(input.product_title || ''),
    niche: input.niche == null ? null : String(input.niche),
    follower_count: Math.trunc(toNumber(input.follower_count, 0)),
    sale_price_vnd: Math.round(toNumber(input.sale_price_vnd, 0)),
    status: String(input.status || 'pending'),
    credentials,
    admin_note: input.admin_note == null ? null : String(input.admin_note),
    created_at: input.created_at == null ? null : String(input.created_at),
  };
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('vi-VN', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'processing') return 'Đang xử lý';
  if (normalized === 'failed') return 'Lỗi';
  if (normalized === 'refunded') return 'Đã hoàn tiền';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'Đã hủy';
  return status || 'Đang chờ';
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (normalized === 'processing') return 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300';
  if (['failed', 'refunded', 'canceled', 'cancelled'].includes(normalized)) {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300';
  }
  return 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300';
}

function credentialEntries(order?: TikTokChannelOrder | null) {
  const credentials = order?.credentials || {};
  return Object.entries(credentialLabels)
    .map(([key, label]) => ({
      key,
      label,
      value: String(credentials[key] ?? '').trim(),
    }))
    .filter((item) => item.value);
}

async function copyText(value: string, message = 'Đã sao chép') {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error('Không thể sao chép');
  }
}

function ProductImage({ product }: { product: TikTokChannelProduct }) {
  const image = product.thumbnail_url || product.photos?.[0] || '';
  if (image) {
    return (
      <img
        src={image}
        alt={product.title}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-950">
      <Music className="h-10 w-10 text-slate-400 dark:text-white/35" />
    </div>
  );
}

function ProductCard({
  product,
  buying,
  onBuy,
}: {
  product: TikTokChannelProduct;
  buying: boolean;
  onBuy: (product: TikTokChannelProduct) => void;
}) {
  return (
    <article className="surface-panel overflow-hidden rounded-[1rem]">
      <div className="relative aspect-[16/10] overflow-hidden border-b border-slate-200/80 dark:border-white/10">
        <ProductImage product={product} />
        <div className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:text-white/80">
          #{product.provider_product_id}
        </div>
        {product.discount_percent > 0 ? (
          <div className="absolute right-3 top-3 rounded-full bg-rose-500 px-3 py-1 text-[11px] font-black text-white">
            -{Math.round(product.discount_percent)}%
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            <Music className="h-3.5 w-3.5 text-rose-500" />
            {product.niche || 'TikTok'}
          </div>
          <h3 className="line-clamp-2 min-h-[3rem] text-base font-black leading-snug text-slate-950 dark:text-white">
            {product.title}
          </h3>
          {product.masked_username ? (
            <p className="text-xs font-semibold text-slate-500 dark:text-white/55">{product.masked_username}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[0.8rem] border border-slate-200/80 p-3 dark:border-white/10">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              <Users className="h-3.5 w-3.5" />
              Follower
            </div>
            <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">{formatCompact(product.follower_count)}</div>
          </div>
          <div className="rounded-[0.8rem] border border-slate-200/80 p-3 dark:border-white/10">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              <Heart className="h-3.5 w-3.5" />
              Like
            </div>
            <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">{formatCompact(product.like_count)}</div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-slate-200/80 pt-4 dark:border-white/10">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Giá bán</div>
            <div className="mt-1 text-xl font-black text-brand-blue">{formatCurrency(product.sale_price_vnd)}</div>
          </div>
          <Button
            type="button"
            onClick={() => onBuy(product)}
            disabled={buying}
            className="min-w-[8rem] gap-2 rounded-[0.85rem]"
          >
            {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
            Mua ngay
          </Button>
        </div>
      </div>
    </article>
  );
}

function CredentialsPanel({ order }: { order?: TikTokChannelOrder | null }) {
  const entries = credentialEntries(order);

  return (
    <section className="surface-panel rounded-[1rem] p-5">
      <SectionHeader
        eyebrow="Credential"
        title="Kênh đã mua"
        description={order ? order.order_code : 'Đơn hoàn tất sẽ hiện ở đây.'}
      />

      {!order ? (
        <div className="mt-5 rounded-[0.9rem] border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500 dark:border-white/12 dark:text-white/55">
          Chưa có đơn hoàn tất trong phiên này.
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-5 rounded-[0.9rem] border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-semibold text-amber-700 dark:text-amber-200">
          Đơn đã ghi nhận, credential chưa có dữ liệu hiển thị.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {entries.map((item) => (
            <div key={item.key} className="rounded-[0.85rem] border border-slate-200/80 p-3 dark:border-white/10">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</span>
                <button
                  type="button"
                  onClick={() => copyText(item.value, `Đã copy ${item.label}`)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-blue dark:hover:bg-white/8"
                  aria-label={`Copy ${item.label}`}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="break-all font-mono text-sm font-bold text-slate-950 dark:text-white">{item.value}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OrdersPanel({ orders, loading }: { orders: TikTokChannelOrder[]; loading: boolean }) {
  return (
    <section className="surface-panel rounded-[1rem] p-5">
      <SectionHeader eyebrow="Lịch sử" title="Đơn Kênh TikTok" description={`${orders.length} đơn gần nhất`} />

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-white/55">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải đơn
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[0.9rem] border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500 dark:border-white/12 dark:text-white/55">
            Chưa có đơn Kênh TikTok.
          </div>
        ) : orders.slice(0, 8).map((order) => (
          <div key={order.order_code} className="rounded-[0.9rem] border border-slate-200/80 p-3 dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-950 dark:text-white">{order.product_title}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-white/50">{order.order_code} · {formatDateTime(order.created_at)}</div>
              </div>
              <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black', statusClass(order.status))}>
                {statusLabel(order.status)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-500 dark:text-white/55">{formatCompact(order.follower_count)} followers</span>
              <span className="font-black text-brand-blue">{formatCurrency(order.sale_price_vnd)}</span>
            </div>
            {credentialEntries(order).length > 0 ? (
              <button
                type="button"
                onClick={() => copyText(JSON.stringify(order.credentials, null, 2), 'Đã copy credential')}
                className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-brand-blue"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Copy credential
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function TikTokChannelPage() {
  const { data: user } = useSessionUser();
  const { setBalances } = useWalletBalance();
  const [products, setProducts] = useState<TikTokChannelProduct[]>([]);
  const [orders, setOrders] = useState<TikTokChannelOrder[]>([]);
  const [niches, setNiches] = useState<NicheOption[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: 16, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [niche, setNiche] = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [maxFollowers, setMaxFollowers] = useState('');
  const [confirmProduct, setConfirmProduct] = useState<TikTokChannelProduct | null>(null);
  const [purchasingId, setPurchasingId] = useState<number | null>(null);
  const [lastOrder, setLastOrder] = useState<TikTokChannelOrder | null>(null);

  const completedOrder = useMemo(
    () => lastOrder || orders.find((order) => order.status.toLowerCase() === 'completed') || null,
    [lastOrder, orders]
  );

  async function loadProducts(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '16',
      });
      if (search) params.set('search', search);
      if (niche) params.set('niche', niche);
      if (minFollowers) params.set('min_followers', String(Math.max(0, Math.trunc(toNumber(minFollowers, 0)))));
      if (maxFollowers) params.set('max_followers', String(Math.max(0, Math.trunc(toNumber(maxFollowers, 0)))));

      const response = await fetch(`/api/kenh-tiktok/products?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{
        success: boolean;
        data?: Array<Record<string, unknown>>;
        meta?: { niches?: NicheOption[] };
        pagination?: Pagination;
      }>(response, 'Không tải được danh sách kênh TikTok');

      setProducts((payload.data || []).map(normalizeProduct));
      setNiches(payload.meta?.niches || []);
      if (payload.pagination) setPagination(payload.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được danh sách kênh TikTok');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/kenh-tiktok/order', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{ success: boolean; data?: Array<Record<string, unknown>> }>(
        response,
        'Không tải được đơn Kênh TikTok'
      );
      setOrders((payload.data || []).map(normalizeOrder));
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    void loadProducts(1);
  }, [search, niche, minFollowers, maxFollowers]);

  useEffect(() => {
    void loadOrders();
  }, []);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setNiche('');
    setMinFollowers('');
    setMaxFollowers('');
  }

  async function buyProduct(product: TikTokChannelProduct) {
    setPurchasingId(product.id);
    try {
      const response = await fetch('/api/kenh-tiktok/order', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, confirm: true }),
      });
      const payload = await readJsonResponse<{
        success: boolean;
        message?: string;
        data?: { order?: Record<string, unknown>; balance_after?: number };
      }>(response, 'Không mua được kênh TikTok');

      if (typeof payload.data?.balance_after === 'number') {
        setBalances({ balance: payload.data.balance_after });
      }

      const order = payload.data?.order ? normalizeOrder(payload.data.order) : null;
      if (order) {
        setLastOrder(order);
        setOrders((current) => [order, ...current.filter((item) => item.order_code !== order.order_code)]);
      } else {
        await loadOrders();
      }

      setConfirmProduct(null);
      toast.success(payload.message || 'Đã mua kênh TikTok');
      await loadProducts(pagination.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không mua được kênh TikTok');
    } finally {
      setPurchasingId(null);
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Kênh TikTok"
          title="Kênh TikTok"
          description="Danh sách kênh đồng bộ từ Kênh Giá Rẻ, thanh toán bằng ví chính và nhận credential ngay khi đơn hoàn tất."
          stats={[
            { label: 'Đang bán', value: `${pagination.total} kênh`, hint: 'Có credential', tone: 'blue' },
            { label: 'Ngách', value: `${niches.length}`, hint: 'Đang có hàng', tone: 'emerald' },
            { label: 'Đơn của bạn', value: `${orders.length}`, hint: 'Gần nhất', tone: 'amber' },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="surface-panel rounded-[1rem] p-4">
              <form onSubmit={applySearch} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_150px_150px_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Tìm tên kênh, ngách..."
                    className="h-12 w-full rounded-[0.9rem] border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-blue dark:border-white/10 dark:bg-slate-950/60 dark:text-white"
                  />
                </label>

                <select
                  value={niche}
                  onChange={(event) => setNiche(event.target.value)}
                  className="h-12 rounded-[0.9rem] border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 outline-none focus:border-brand-blue dark:border-white/10 dark:bg-slate-950/60 dark:text-white"
                >
                  <option value="">Tất cả ngách</option>
                  {niches.map((item) => (
                    <option key={item.value} value={item.value}>{item.label} ({item.total})</option>
                  ))}
                </select>

                <input
                  value={minFollowers}
                  onChange={(event) => setMinFollowers(event.target.value)}
                  inputMode="numeric"
                  placeholder="Min follow"
                  className="h-12 rounded-[0.9rem] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-brand-blue dark:border-white/10 dark:bg-slate-950/60 dark:text-white"
                />

                <input
                  value={maxFollowers}
                  onChange={(event) => setMaxFollowers(event.target.value)}
                  inputMode="numeric"
                  placeholder="Max follow"
                  className="h-12 rounded-[0.9rem] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-brand-blue dark:border-white/10 dark:bg-slate-950/60 dark:text-white"
                />

                <div className="flex gap-2">
                  <Button type="submit" className="h-12 rounded-[0.9rem] px-4">
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" onClick={clearFilters} className="h-12 rounded-[0.9rem] px-4">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </section>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="surface-panel h-[25rem] animate-pulse rounded-[1rem]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  icon={<Music className="h-5 w-5" />}
                  title="Chưa có kênh TikTok"
                  description="Owner cần cấu hình API Kênh Giá Rẻ và bấm đồng bộ trong admin."
                />
                <div className="flex justify-center">
                  <Button type="button" variant="outline" onClick={() => loadProducts(1)} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Tải lại
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      buying={purchasingId === product.id}
                      onBuy={setConfirmProduct}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => loadProducts(pagination.page - 1)}
                  >
                    Trang trước
                  </Button>
                  <div className="text-sm font-black text-slate-500 dark:text-white/55">
                    Trang {pagination.page}/{pagination.total_pages}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pagination.page >= pagination.total_pages || loading}
                    onClick={() => loadProducts(pagination.page + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              </>
            )}
          </div>

          <aside className="space-y-4">
            <section className="surface-panel rounded-[1rem] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] bg-brand-blue/10 text-brand-blue">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-950 dark:text-white">Nguồn Kênh Giá Rẻ</div>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500 dark:text-white/55">
                    Giá bán lấy từ cấu hình web. Giá API chỉ dùng để owner đối chiếu lợi nhuận.
                  </p>
                </div>
              </div>
            </section>

            <CredentialsPanel order={completedOrder} />
            <OrdersPanel orders={orders} loading={loadingOrders} />
          </aside>
        </div>
      </div>

      {confirmProduct ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1rem] border border-white/10 bg-white p-5 shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-blue">Xác nhận mua</div>
                <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">{confirmProduct.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmProduct(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/8"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-[0.9rem] border border-slate-200 p-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-500 dark:text-white/55">Thanh toán ví chính</span>
                <span className="text-xl font-black text-brand-blue">{formatCurrency(confirmProduct.sale_price_vnd)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-500 dark:text-white/55">
                <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> {formatCompact(confirmProduct.follower_count)} followers</span>
                <span className="inline-flex items-center gap-2"><Heart className="h-4 w-4" /> {formatCompact(confirmProduct.like_count)} likes</span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-[0.9rem] border border-amber-500/20 bg-amber-500/10 p-3 text-sm font-semibold text-amber-700 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Hệ thống sẽ gọi API Kênh Giá Rẻ để nhận credential và lưu vào lịch sử đơn.
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setConfirmProduct(null)} disabled={purchasingId === confirmProduct.id}>
                Hủy
              </Button>
              <Button
                type="button"
                onClick={() => buyProduct(confirmProduct)}
                disabled={purchasingId === confirmProduct.id}
                className="gap-2"
              >
                {purchasingId === confirmProduct.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
