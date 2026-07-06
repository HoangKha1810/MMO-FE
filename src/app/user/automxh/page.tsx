'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Facebook, Flame, Instagram, Loader2, Music, Twitter, Youtube, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { cn, slugify } from '@/lib/utils';

interface AutoMxhCategory {
  id: number;
  name: string;
  slug: string;
  gif: string;
}

interface AutoMxhProduct {
  id: number;
  category_id: number;
  name: string;
  description: string;
  badge?: string;
  min_price: number;
  variant_count: number;
}

interface AutoMxhCatalogSection {
  category: AutoMxhCategory;
  products: AutoMxhProduct[];
}

interface AutoMxhGroupedSection {
  groupKey: string;
  groupLabel: string;
  sections: AutoMxhCatalogSection[];
  totalProducts: number;
}

interface CatalogResponse {
  success: boolean;
  message?: string;
  data?: AutoMxhCatalogSection[];
}

function assetUrl(value: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `/${value.replace(/^\/+/, '').replace(/^public\//, '')}`;
}

function normalizePlatformGroup(name: string) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('facebook') || lower.includes('fb')) return 'Facebook';
  if (lower.includes('instagram') || lower.includes('ig')) return 'Instagram';
  if (lower.includes('tiktok') || lower.includes('tik tok')) return 'TikTok';
  if (lower.includes('twitter') || lower.includes('x twitter') || lower.includes('x / twitter')) return 'X Twitter';
  if (lower.includes('youtube') || lower.includes('yt')) return 'YouTube';
  return name || 'Khác';
}

function platformPriority(label: string) {
  const normalized = String(label || '').toLowerCase();
  if (normalized.includes('facebook')) return 10;
  if (normalized.includes('tiktok')) return 20;
  if (normalized.includes('instagram')) return 30;
  if (normalized.includes('twitter')) return 40;
  if (normalized.includes('youtube')) return 50;
  return 100;
}

function normalizePlatformKey(value: string) {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('facebook') || lower === 'fb') return 'facebook';
  if (lower.includes('tiktok') || lower.includes('tik-tok')) return 'tiktok';
  if (lower.includes('instagram') || lower === 'insta' || lower === 'ig') return 'instagram';
  if (lower.includes('twitter') || lower.includes('x-twitter') || lower === 'x') return 'x-twitter';
  if (lower.includes('youtube') || lower === 'yt') return 'youtube';
  return lower;
}

function isHotBadge(value?: string) {
  return String(value || '').trim().toLowerCase().includes('hot');
}

export default function UserAutomxhPage() {
  const currentUser = useSessionUser();
  const searchParams = useSearchParams();
  const user = currentUser.data;
  const [sections, setSections] = useState<AutoMxhCatalogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const activePlatform = normalizePlatformKey(searchParams.get('platform') || '');
  const groupedSections = useMemo<AutoMxhGroupedSection[]>(() => {
    const groups = new Map<string, AutoMxhGroupedSection>();

    for (const section of sections) {
      const groupLabel = normalizePlatformGroup(section.category.name);
      const groupKey = slugify(groupLabel);
      const existing = groups.get(groupKey);
      if (existing) {
        existing.sections.push(section);
        existing.totalProducts += section.products.length;
      } else {
        groups.set(groupKey, {
          groupKey,
          groupLabel,
          sections: [section],
          totalProducts: section.products.length,
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      const priorityDiff = platformPriority(a.groupLabel) - platformPriority(b.groupLabel);
      if (priorityDiff !== 0) return priorityDiff;
      return a.groupLabel.localeCompare(b.groupLabel, 'vi');
    });
  }, [sections]);
  const visibleGroups = useMemo(() => {
    if (!activePlatform) return groupedSections;
    return groupedSections.filter((group) => normalizePlatformKey(group.groupLabel) === activePlatform);
  }, [activePlatform, groupedSections]);
  const platformTabs = [
    { key: '', label: 'Tất cả', icon: Zap, tone: 'text-cyan-300' },
    { key: 'facebook', label: 'Facebook', icon: Facebook, gif: 'assets/images/gif/facebook_gif.gif', tone: 'text-[#1877F2]' },
    { key: 'tiktok', label: 'TikTok', icon: Music, gif: 'assets/images/gif/tiktok_gif.gif', tone: 'text-white' },
    { key: 'instagram', label: 'Instagram', icon: Instagram, gif: 'assets/images/gif/ig_gif.gif', tone: 'text-pink-400' },
    { key: 'x-twitter', label: 'Twitter', icon: Twitter, gif: 'assets/images/gif/tw_gif.gif', tone: 'text-sky-300' },
    { key: 'youtube', label: 'YouTube', icon: Youtube, gif: 'assets/images/gif/youtube_gif.gif', tone: 'text-red-400' },
  ];

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/automxh/catalog');
        const payload: CatalogResponse = await response.json();

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || 'Không thể tải dịch vụ Auto MXH');
        }

        if (active) {
          setSections(payload.data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải dịch vụ Auto MXH');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell user={user}>
      <div className="automxh-page space-y-10 px-1 py-4 pb-20 sm:py-8">
        {error ? (
          <div className="error-state rounded-[1rem] border border-rose-500/20 bg-rose-500/10 p-6 text-sm font-bold text-rose-500">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải Auto MXH
            </div>
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="empty-state flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-500 shadow-xl shadow-orange-500/5">
              <Zap className="h-12 w-12" />
            </div>
            <h2 className="mb-3 text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
              Chưa có dịch vụ Auto MXH
            </h2>
            <p className="max-w-sm text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Hiện chưa có dịch vụ phù hợp với bộ lọc đang chọn.
            </p>
          </div>
        ) : (
          <>
          <div className="automxh-platform-tabs sticky top-3 z-10 flex gap-2 overflow-x-auto rounded-[0.95rem] border border-cyan-300/12 bg-[#050f1e]/92 p-2 shadow-[0_20px_48px_-34px_rgba(14,165,233,0.65)] backdrop-blur-xl">
            {platformTabs.map((tab) => {
              const active = activePlatform === tab.key || (!activePlatform && tab.key === '');
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.key || 'all'}
                  href={tab.key ? `/user/automxh?platform=${tab.key}` : '/user/automxh'}
                  className={`group inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[0.8rem] border px-3 text-[10px] font-black uppercase tracking-[0.13em] transition-all ${
                    active
                      ? 'border-cyan-300/55 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_14px_34px_-22px_rgba(34,211,238,0.95)]'
                      : 'border-cyan-300/10 bg-[#07182c]/88 text-slate-300 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white'
                  }`}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-300/10 bg-cyan-400/8',
                      active && 'border-white/20 bg-white/15'
                    )}
                  >
                    {tab.gif ? (
                      <img src={assetUrl(tab.gif)} alt="" className="h-4 w-4 object-contain" />
                    ) : (
                      <Icon className={cn('h-3.5 w-3.5', active ? 'text-white' : tab.tone)} />
                    )}
                  </span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>

          {visibleGroups.map((group: AutoMxhGroupedSection) => (
            <section key={group.groupKey} className="category-section space-y-6 scroll-mt-28">
              <div className="mmo-section-title-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/8 shadow-sm shadow-cyan-500/10">
                    {group.sections[0]?.category.gif ? (
                      <img src={assetUrl(group.sections[0].category.gif)} className="h-6 w-6 object-contain" alt="" />
                    ) : (
                      <Zap className="h-5 w-5 text-orange-500" />
                    )}
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    {group.groupLabel}
                  </h2>
                </div>
                <span className="mmo-chip px-2.5 py-1">
                  {group.totalProducts} dịch vụ
                </span>
              </div>

              {group.sections.map((section: AutoMxhCatalogSection) => (
                <div key={section.category.id} className="space-y-4">
                  {group.sections.length > 1 ? (
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                        {section.category.name}
                      </h3>
                      <span className="mmo-chip px-2.5 py-1">
                        {section.products.length} dịch vụ
                      </span>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {section.products.map((product: AutoMxhProduct) => (
                      <div key={product.id} className="service-card-wrapper h-full">
                        <div
                          className={`smm-service-card-3d group relative flex h-full flex-col overflow-hidden rounded-[1rem] border transition-all hover:border-brand-blue hover:shadow-xl ${
                            isHotBadge(product.badge)
                              ? 'border-rose-400/55 bg-rose-500/[0.06] shadow-[0_0_0_1px_rgba(251,113,133,0.14),0_22px_55px_-38px_rgba(244,63,94,0.95)]'
                              : ''
                          }`}
                        >
                          {isHotBadge(product.badge) ? (
                            <div className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-rose-200/75 bg-gradient-to-r from-rose-600 via-red-500 to-orange-400 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_32px_-14px_rgba(251,113,133,0.95)] ring-2 ring-rose-400/20">
                              <Flame className="h-3 w-3" />
                              HOT
                            </div>
                          ) : product.badge ? (
                            <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-cyan-300/35 bg-cyan-500/14 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200 shadow-[0_12px_30px_-18px_rgba(34,211,238,0.8)]">
                              {product.badge}
                            </div>
                          ) : null}
                          <Link
                            href={`/user/automxh/order/${slugify(section.category.name)}?product=${product.id}`}
                            className="smm-service-card-content group/link flex flex-1 flex-col p-4"
                          >
                            <div className="smm-service-card-icon mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 transition-transform duration-300 group-hover:scale-110">
                              <Zap className="h-5 w-5 text-orange-500" />
                            </div>

                            <h3 className="mb-2 text-[12px] font-black uppercase leading-tight text-white">
                              {product.name}
                            </h3>

                            <div className="mb-4">
                              <p className="line-clamp-2 text-[10px] italic text-slate-400">
                                {product.description || 'Cung cấp đa dạng các gói dịch vụ chất lượng cao.'}
                              </p>
                            </div>

                            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
                              <div className="smm-service-card-arrow flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue transition-all duration-300 group-hover/link:bg-brand-blue group-hover/link:text-white">
                                <ArrowRight className="h-3 w-3" />
                              </div>
                            </div>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
