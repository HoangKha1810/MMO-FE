'use client';

import { type FormEvent, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Copy,
  Eye,
  Heart,
  ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Search,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHero } from '@/components/ui/page-layout';
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

function productImages(product: TikTokChannelProduct) {
  const seen = new Set<string>();
  return [product.thumbnail_url, ...(product.photos || [])]
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function ProductImage({ product }: { product: TikTokChannelProduct }) {
  const image = productImages(product)[0] || '';
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
  onDetails,
}: {
  product: TikTokChannelProduct;
  buying: boolean;
  onBuy: (product: TikTokChannelProduct) => void;
  onDetails: (product: TikTokChannelProduct) => void;
}) {
  const imageCount = productImages(product).length;

  return (
    <article className="surface-panel overflow-hidden rounded-[1rem]">
      <button
        type="button"
        onClick={() => onDetails(product)}
        className="relative block aspect-[16/10] w-full overflow-hidden border-b border-slate-200/80 text-left dark:border-white/10"
        aria-label={`Xem chi tiết ${product.title}`}
      >
        <ProductImage product={product} />
        <div className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:text-white/80">
          #{product.provider_product_id}
        </div>
        {product.discount_percent > 0 ? (
          <div className="absolute right-3 top-3 rounded-full bg-rose-500 px-3 py-1 text-[11px] font-black text-white">
            -{Math.round(product.discount_percent)}%
          </div>
        ) : null}
        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[11px] font-black text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:text-white/80">
          <ImageIcon className="h-3.5 w-3.5" />
          {imageCount || 1}
        </div>
      </button>

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

        <div className="space-y-3 border-t border-slate-200/80 pt-4 dark:border-white/10">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Giá bán</div>
            <div className="mt-1 text-xl font-black text-brand-blue">{formatCurrency(product.sale_price_vnd)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onDetails(product)}
              className="gap-2 rounded-[0.85rem]"
            >
              <Eye className="h-4 w-4" />
              Chi tiết
            </Button>
            <Button
              type="button"
              onClick={() => onBuy(product)}
              disabled={buying}
              className="gap-2 rounded-[0.85rem]"
            >
              {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Mua ngay
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProductDetailModal({
  product,
  imageIndex,
  onImageIndexChange,
  onClose,
  onBuy,
  buying,
}: {
  product: TikTokChannelProduct;
  imageIndex: number;
  onImageIndexChange: (index: number) => void;
  onClose: () => void;
  onBuy: (product: TikTokChannelProduct) => void;
  buying: boolean;
}) {
  const images = productImages(product);
  const safeImageIndex = images.length > 0 ? Math.min(Math.max(imageIndex, 0), images.length - 1) : 0;
  const activeImage = images[safeImageIndex] || '';
  const canStep = images.length > 1;

  function stepImage(direction: -1 | 1) {
    if (!canStep) return;
    const nextIndex = (safeImageIndex + direction + images.length) % images.length;
    onImageIndexChange(nextIndex);
  }

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-6xl overflow-hidden rounded-[1rem] border border-white/10 bg-white shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 p-4 dark:border-white/10 sm:p-5">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-blue">Chi tiết kênh</div>
            <h2 className="mt-2 line-clamp-2 text-xl font-black text-slate-950 dark:text-white sm:text-2xl">{product.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-white/55">
              #{product.provider_product_id} · {product.niche || 'TikTok'} · {product.masked_username || 'username ẩn'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/8"
            aria-label="Đóng chi tiết"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid max-h-[calc(92dvh-5.5rem)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="relative overflow-hidden rounded-[1rem] border border-slate-200/80 bg-slate-100 dark:border-white/10 dark:bg-slate-900">
              <div className="flex aspect-[16/10] items-center justify-center">
                {activeImage ? (
                  <img src={activeImage} alt={`${product.title} ảnh ${safeImageIndex + 1}`} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400 dark:text-white/45">
                    <ImageIcon className="h-12 w-12" />
                    <span className="text-sm font-black uppercase tracking-[0.14em]">Chưa có ảnh</span>
                  </div>
                )}
              </div>

              {canStep ? (
                <>
                  <button
                    type="button"
                    onClick={() => stepImage(-1)}
                    className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:text-brand-blue dark:border-white/10 dark:bg-slate-950/75 dark:text-white"
                    aria-label="Ảnh trước"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepImage(1)}
                    className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:text-brand-blue dark:border-white/10 dark:bg-slate-950/75 dark:text-white"
                    aria-label="Ảnh sau"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}

              <div className="absolute bottom-3 right-3 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-black text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:text-white">
                {images.length > 0 ? `${safeImageIndex + 1}/${images.length}` : '0/0'}
              </div>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => onImageIndexChange(index)}
                    className={cn(
                      'aspect-square overflow-hidden rounded-[0.75rem] border bg-slate-100 transition dark:bg-slate-900',
                      index === safeImageIndex
                        ? 'border-brand-blue ring-2 ring-brand-blue/25'
                        : 'border-slate-200/80 hover:border-brand-blue/50 dark:border-white/10'
                    )}
                    aria-label={`Xem ảnh ${index + 1}`}
                  >
                    <img src={image} alt={`${product.title} thumbnail ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="border-t border-slate-200/80 p-4 dark:border-white/10 lg:border-l lg:border-t-0 sm:p-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[0.85rem] border border-slate-200/80 p-3 dark:border-white/10">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Follower</div>
                  <div className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{formatCompact(product.follower_count)}</div>
                </div>
                <div className="rounded-[0.85rem] border border-slate-200/80 p-3 dark:border-white/10">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Like</div>
                  <div className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{formatCompact(product.like_count)}</div>
                </div>
              </div>

              {product.description ? (
                <div className="rounded-[0.85rem] border border-slate-200/80 p-3 text-sm font-semibold leading-6 text-slate-600 dark:border-white/10 dark:text-white/60">
                  {product.description}
                </div>
              ) : null}

              <div className="rounded-[0.85rem] border border-brand-blue/20 bg-brand-blue/8 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Giá bán</div>
                <div className="mt-1 text-3xl font-black text-brand-blue">{formatCurrency(product.sale_price_vnd)}</div>
              </div>

              <div className="grid gap-2">
                <Button
                  type="button"
                  onClick={() => onBuy(product)}
                  disabled={buying}
                  className="gap-2 rounded-[0.85rem]"
                >
                  {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                  Mua kênh này
                </Button>
                <Button type="button" variant="outline" onClick={onClose} className="rounded-[0.85rem]">
                  Đóng
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PurchasedOrdersModal({
  orders,
  loading,
  onClose,
}: {
  orders: TikTokChannelOrder[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[91] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[1rem] border border-white/10 bg-white shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-white/10">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-blue">Đơn đã mua</div>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Đơn Kênh TikTok</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-white/55">{orders.length} đơn gần nhất</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/8 dark:hover:text-white"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center gap-2 rounded-[0.9rem] border border-slate-200 p-5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải đơn
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-[0.9rem] border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500 dark:border-white/12 dark:text-white/55">
              Chưa có đơn Kênh TikTok.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const entries = credentialEntries(order);

                return (
                  <div key={order.order_code} className="rounded-[0.9rem] border border-slate-200/80 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="max-w-xl truncate text-sm font-black text-slate-950 dark:text-white">{order.product_title}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-white/50">
                          {order.order_code} · {formatDateTime(order.created_at)}
                        </div>
                      </div>
                      <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black', statusClass(order.status))}>
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-500 dark:text-white/55">{formatCompact(order.follower_count)} followers</span>
                      <span className="font-black text-brand-blue">{formatCurrency(order.sale_price_vnd)}</span>
                    </div>
                    {entries.length > 0 ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {entries.map((item) => (
                          <div key={`${order.order_code}-${item.key}`} className="rounded-[0.8rem] border border-slate-200/80 p-3 dark:border-white/10">
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</span>
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
                        <button
                          type="button"
                          onClick={() => copyText(JSON.stringify(order.credentials, null, 2), 'Đã copy toàn bộ credential')}
                          className="inline-flex min-h-16 items-center justify-center gap-2 rounded-[0.8rem] border border-brand-blue/25 bg-brand-blue/8 px-3 text-xs font-black uppercase tracking-[0.12em] text-brand-blue transition hover:bg-brand-blue/12 sm:col-span-2"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy toàn bộ credential
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[0.8rem] border border-amber-500/25 bg-amber-500/10 p-3 text-sm font-semibold text-amber-700 dark:text-amber-200">
                        Đơn đã ghi nhận, credential chưa có dữ liệu hiển thị.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [detailProduct, setDetailProduct] = useState<TikTokChannelProduct | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [purchasingId, setPurchasingId] = useState<number | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);

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

  function openDetails(product: TikTokChannelProduct) {
    setDetailProduct(product);
    setDetailImageIndex(0);
  }

  function requestBuy(product: TikTokChannelProduct) {
    setDetailProduct(null);
    setConfirmProduct(product);
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
        setOrders((current) => [order, ...current.filter((item) => item.order_code !== order.order_code)]);
        setOrdersOpen(true);
      } else {
        await loadOrders();
        setOrdersOpen(true);
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
          actions={
            <Button type="button" variant="outline" onClick={() => setOrdersOpen(true)} className="gap-2 rounded-full">
              {loadingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Đơn đã mua
              <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-black text-brand-blue">
                {orders.length}
              </span>
            </Button>
          }
        />

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
                    onBuy={requestBuy}
                    onDetails={openDetails}
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
      </div>

      {ordersOpen ? (
        <PurchasedOrdersModal orders={orders} loading={loadingOrders} onClose={() => setOrdersOpen(false)} />
      ) : null}

      {detailProduct ? (
        <ProductDetailModal
          product={detailProduct}
          imageIndex={detailImageIndex}
          onImageIndexChange={setDetailImageIndex}
          onClose={() => setDetailProduct(null)}
          onBuy={requestBuy}
          buying={purchasingId === detailProduct.id}
        />
      ) : null}

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
