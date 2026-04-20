'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  AtSign,
  Eye,
  Flame,
  Grid3X3,
  Heart,
  LayoutPanelTop,
  Loader2,
  MessageCircle,
  Music,
  Play,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShoppingCart,
  Star,
  ThumbsUp,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import type { SmmProviderMeta, SmmServiceRecord } from '@/lib/smm-provider';
import { cn, formatNumber, slugify } from '@/lib/utils';

interface ServicesResponse {
  success: boolean;
  message?: string;
  meta?: SmmProviderMeta;
  data?: SmmServiceRecord[];
}

interface PlatformConfig {
  name: string;
  tag: string;
  gif?: string;
  Icon: LucideIcon;
  color: string;
}

interface CategoryGroup {
  platform: PlatformConfig;
  category: string;
  cleanName: string;
  services: SmmServiceRecord[];
  minQty: number;
  maxQty: number;
  minPrice: number;
  maxPrice: number;
  totalOrders: number;
  isNew: boolean;
}

const platformConfig: PlatformConfig[] = [
  { name: 'Facebook', tag: '[FB]', gif: 'facebook_gif.gif', Icon: ThumbsUp, color: 'text-blue-500' },
  { name: 'TikTok', tag: '[TT]', gif: 'tiktok_gif.gif', Icon: Music, color: 'text-slate-900 dark:text-white' },
  { name: 'Instagram', tag: '[IG]', gif: 'ig_gif.gif', Icon: AtSign, color: 'text-pink-500' },
  { name: 'YouTube', tag: '[YT]', gif: 'youtube_gif.gif', Icon: Play, color: 'text-red-500' },
  { name: 'Telegram', tag: '[TG]', Icon: Send, color: 'text-sky-500' },
  { name: 'Twitter', tag: '[TW]', gif: 'tw_gif.gif', Icon: AtSign, color: 'text-sky-400' },
  { name: 'Shopee', tag: '[SP]', Icon: ShoppingCart, color: 'text-orange-500' },
  { name: 'Spotify', tag: '[SPOTIFY]', Icon: Music, color: 'text-green-500' },
  { name: 'WhatsApp', tag: '[WHATSAPP]', Icon: MessageCircle, color: 'text-green-500' },
  { name: 'Bigo', tag: '[BIGO]', Icon: Video, color: 'text-purple-500' },
  { name: 'Threads', tag: '[THREADS]', Icon: AtSign, color: 'text-slate-700 dark:text-white' },
  { name: 'Khác', tag: '[OTHER]', Icon: Grid3X3, color: 'text-slate-500' },
];

function shortQty(value: number) {
  if (value >= 1_000_000_000) return `${Number((value / 1_000_000_000).toFixed(1))}B`;
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`;
  return formatNumber(value);
}

function cleanCategoryName(category: string) {
  return category.replace(/\[.*?\]\s*/g, '').trim() || category;
}

function getServiceIcon(name: string): LucideIcon {
  const normalized = name.toLowerCase();
  const iconMap: Array<[string, LucideIcon]> = [
    ['like', Heart],
    ['tim', Heart],
    ['bình luận', MessageCircle],
    ['comment', MessageCircle],
    ['theo dõi', UserPlus],
    ['follow', UserPlus],
    ['chia sẻ', Share2],
    ['share', Share2],
    ['group', Users],
    ['member', Users],
    ['thành viên', Users],
    ['view', Eye],
    ['xem', Eye],
    ['video', Play],
    ['live', Video],
    ['đánh giá', Star],
    ['review', Star],
    ['sub', UserCheck],
  ];

  return iconMap.find(([keyword]) => normalized.includes(keyword))?.[1] || LayoutPanelTop;
}

function matchesPlatform(service: SmmServiceRecord, platform: PlatformConfig): boolean {
  if (platform.name === 'Khác') {
    return !platformConfig
      .filter((item) => item.name !== 'Khác')
      .some((item) => matchesPlatform(service, item));
  }

  const haystack = `${service.platform} ${service.category}`.toLowerCase();
  return haystack.includes(platform.name.toLowerCase()) || haystack.includes(platform.tag.toLowerCase());
}

function formatPerUnit(pricePer1k: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(pricePer1k / 1000);
}

function buildGroups(services: SmmServiceRecord[]) {
  const newestIds = new Set(
    [...services]
      .sort((a, b) => b.id - a.id)
      .slice(0, 50)
      .map((service) => service.service)
  );

  return platformConfig
    .map((platform) => {
      const platformServices = services.filter((service) => matchesPlatform(service, platform));
      const categoryMap = new Map<string, SmmServiceRecord[]>();

      for (const service of platformServices) {
        const current = categoryMap.get(service.category) || [];
        current.push(service);
        categoryMap.set(service.category, current);
      }

      const groups = Array.from(categoryMap.entries()).map<CategoryGroup>(([category, items]) => {
        const prices = items.map((service) => service.price_per_1k_vnd).filter((value) => value > 0);
        return {
          platform,
          category,
          cleanName: cleanCategoryName(category),
          services: items,
          minQty: Math.min(...items.map((service) => service.min)),
          maxQty: Math.max(...items.map((service) => service.max)),
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          totalOrders: items.reduce((sum, service) => sum + (service.total_orders || 0), 0),
          isNew: items.some((service) => newestIds.has(service.service)),
        };
      });

      return {
        platform,
        groups,
      };
    })
    .filter((section) => section.groups.length > 0);
}

function ServiceCard({
  group,
  favorites,
  onToggleFavorite,
}: {
  group: CategoryGroup;
  favorites: string[];
  onToggleFavorite: (category: string) => void;
}) {
  const Icon = getServiceIcon(group.cleanName);
  const isFavorite = favorites.includes(group.category);
  const isHot = group.totalOrders >= 5;

  return (
    <div className="service-card-wrapper h-full">
      <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white transition-all hover:border-brand-blue hover:shadow-xl dark:border-white/10 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={() => onToggleFavorite(group.category)}
          className={cn(
            'absolute right-2 top-2 z-10 rounded-lg bg-slate-50 p-1.5 text-slate-300 shadow-sm transition-all hover:text-yellow-500 dark:bg-white/5',
            isFavorite && 'bg-yellow-500/10 text-yellow-500'
          )}
          aria-label="Lưu dịch vụ"
        >
          <Star className={cn('h-3 w-3', isFavorite && 'fill-current')} />
        </button>

        <Link href={`/user/smm/order/${slugify(group.category)}`} className="group/link flex flex-1 flex-col p-4">
          <div className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 transition-transform duration-300 group-hover:scale-110 dark:bg-white/5">
            <Icon className={cn('h-5 w-5', group.platform.color)} />
          </div>

          <h3 className="mb-2 text-[12px] font-black leading-tight text-slate-800 dark:text-white">
            {group.cleanName}
            <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
              {isHot ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-orange-500 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-tighter text-white shadow-sm">
                  <Flame className="h-2 w-2" />
                  HOT
                </span>
              ) : null}
              {group.isNew ? (
                <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-tighter text-white shadow-sm">
                  Mới
                </span>
              ) : null}
            </span>
          </h3>

          <div className="mb-4">
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200/50 bg-slate-100 px-2 py-0.5 dark:border-white/5 dark:bg-white/5">
              <span className="text-[7px] font-black uppercase text-slate-400">Min</span>
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {shortQty(group.minQty)}
              </span>
              <span className="text-[8px] text-slate-300 dark:text-slate-700">/</span>
              <span className="text-[7px] font-black uppercase text-slate-400">Max</span>
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {shortQty(group.maxQty)}
              </span>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
            <div className="flex flex-col">
              <span className="mb-1 text-[7px] font-bold uppercase leading-none tracking-widest text-slate-400">
                Giá
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="font-mono text-[14px] font-black tracking-tighter text-emerald-500">
                  {formatPerUnit(group.minPrice)}
                </span>
                {group.maxPrice > group.minPrice ? (
                  <>
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">-</span>
                    <span className="font-mono text-[14px] font-black tracking-tighter text-emerald-500">
                      {formatPerUnit(group.maxPrice)}
                    </span>
                  </>
                ) : null}
                <span className="ml-1 text-[8px] font-black uppercase leading-none text-emerald-500/70">
                  đ / lượt
                </span>
              </div>
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue transition-all duration-300 group-hover/link:bg-brand-blue group-hover/link:text-white">
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function SmmPageContent() {
  const currentUser = useSessionUser();
  const searchParams = useSearchParams();
  const user = currentUser.data;
  const [services, setServices] = useState<SmmServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  async function loadServices(forceRefresh = false) {
    setLoading(true);
    setSyncing(forceRefresh);
    setError('');

    try {
      const response = await fetch(`/api/smm/services${forceRefresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      const payload: ServicesResponse = await response.json();

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || 'Không thể tải danh sách dịch vụ SMM');
      }

      setServices(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải dịch vụ SMM');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    void loadServices();
  }, []);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem('smm_favorites') || '[]'));
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    const keyword = searchParams.get('search') || '';
    const platform = searchParams.get('platform') || '';

    setSearch(keyword);
    setPlatformFilter(platform);
  }, [searchParams]);

  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const activePlatform = platformFilter.trim().toLowerCase();

    return buildGroups(services)
      .filter((section) => !activePlatform || section.platform.name.toLowerCase() === activePlatform)
      .map((section) => ({
        ...section,
        groups: section.groups.filter((group) => {
          const matchesSearch =
            term === '' ||
            group.cleanName.toLowerCase().includes(term) ||
            group.category.toLowerCase().includes(term);
          const matchesFavorite = !favoritesOnly || favorites.includes(group.category);
          return matchesSearch && matchesFavorite;
        }),
      }))
      .filter((section) => section.groups.length > 0);
  }, [favorites, favoritesOnly, platformFilter, search, services]);

  const favoriteGroups = useMemo(() => {
    const groups = buildGroups(services).flatMap((section) => section.groups);
    return groups.filter((group) => favorites.includes(group.category));
  }, [favorites, services]);

  function toggleFavorite(category: string) {
    setFavorites((current) => {
      const next = current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category];
      localStorage.setItem('smm_favorites', JSON.stringify(next));
      return next;
    });
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6 pb-8">
        <div className="sticky top-0 z-30 -mx-2 border-b border-slate-100 bg-white/90 px-2 pb-4 pt-4 shadow-sm backdrop-blur-2xl dark:border-white/5 dark:bg-[#090f1f]/90 md:-mx-4 md:px-4">
          <div className="flex items-center gap-2">
            <div className="group relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand-blue" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên dịch vụ hoặc nền tảng..."
                className="w-full rounded-2xl border border-transparent bg-slate-100 py-3.5 pl-11 pr-4 text-sm font-bold outline-none shadow-inner transition-all focus:border-brand-blue/30 dark:bg-white/5"
              />
            </div>
            <button
              type="button"
              onClick={() => setFavoritesOnly((value) => !value)}
              className={cn(
                'flex items-center justify-center rounded-2xl border border-transparent bg-slate-100 p-3.5 text-slate-400 shadow-sm transition-all active:scale-90 dark:bg-white/5',
                favoritesOnly ? 'bg-yellow-500/10 text-yellow-500' : 'hover:text-yellow-500'
              )}
              aria-label="Chỉ xem dịch vụ đã lưu"
            >
              <Star className={cn('h-5 w-5', favoritesOnly && 'fill-current')} />
            </button>
            <button
              type="button"
              onClick={() => void loadServices(true)}
              disabled={syncing || loading}
              className="flex items-center justify-center rounded-2xl border border-transparent bg-slate-100 p-3.5 text-slate-400 shadow-sm transition-all hover:text-brand-blue active:scale-90 disabled:opacity-60 dark:bg-white/5"
              aria-label="Đồng bộ dịch vụ SubMetaVip"
            >
              <RefreshCw className={cn('h-5 w-5', syncing && 'animate-spin text-brand-blue')} />
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {platformConfig.filter((platform) => platform.name !== 'Khác').map((platform) => {
              const active = platformFilter.toLowerCase() === platform.name.toLowerCase();
              const PlatformIcon = platform.Icon;

              return (
                <button
                  key={platform.name}
                  type="button"
                  onClick={() => setPlatformFilter(active ? '' : platform.name)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all',
                    active
                      ? 'border-brand-blue bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-brand-blue/40 hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                  )}
                >
                  {platform.gif ? (
                    <img src={`/assets/images/gif/${platform.gif}`} alt="" className="h-4 w-4 object-contain" />
                  ) : (
                    <PlatformIcon className={cn('h-4 w-4', active ? 'text-white' : platform.color)} />
                  )}
                  {platform.name}
                </button>
              );
            })}
            {platformFilter || search || favoritesOnly ? (
              <button
                type="button"
                onClick={() => {
                  setPlatformFilter('');
                  setSearch('');
                  setFavoritesOnly(false);
                }}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-500 transition-all hover:bg-rose-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                Xóa lọc
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm font-bold text-rose-500">
            {error}
          </div>
        ) : null}

        {favoriteGroups.length > 0 && !favoritesOnly ? (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-current text-yellow-500" />
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
                Đã lưu
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {favoriteGroups.map((group) => (
                <ServiceCard
                  key={`favorite-${group.category}`}
                  group={group}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
            <div className="h-px w-full bg-slate-100 dark:bg-white/5" />
          </section>
        ) : null}

        <div className="space-y-10 pb-20">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải dịch vụ từ hệ thống
              </div>
            </div>
          ) : sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-500 shadow-xl shadow-rose-500/5">
                <Grid3X3 className="h-12 w-12" />
              </div>
              <h2 className="mb-3 text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
                Chưa có dịch vụ phù hợp
              </h2>
              <p className="max-w-sm text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Không tìm thấy dịch vụ theo từ khóa hiện tại. Thử đổi nền tảng hoặc nhập từ khóa ngắn hơn.
              </p>
            </div>
          ) : (
            sections.map((section) => {
              const PlatformIcon = section.platform.Icon;

              return (
                <section
                  key={section.platform.name}
                  id={`platform-${section.platform.name}`}
                  className="space-y-5 scroll-mt-28"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 shadow-sm dark:bg-white/5">
                        {section.platform.gif ? (
                          <img
                            src={`/assets/images/gif/${section.platform.gif}`}
                            className="h-6 w-6 object-contain"
                            alt=""
                          />
                        ) : (
                          <PlatformIcon className={cn('h-5 w-5', section.platform.color)} />
                        )}
                      </div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Dịch Vụ {section.platform.name}
                      </h2>
                    </div>
                    <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tighter text-slate-400 dark:bg-white/5">
                      {section.groups.length} mục
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {section.groups.map((group) => (
                      <ServiceCard
                        key={group.category}
                        group={group}
                        favorites={favorites}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SmmPageFallback() {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang mở module SMM
        </div>
      </div>
    </AppShell>
  );
}

export default function SmmPage() {
  return (
    <Suspense fallback={<SmmPageFallback />}>
      <SmmPageContent />
    </Suspense>
  );
}
