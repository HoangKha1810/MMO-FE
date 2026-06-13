'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Flame, Loader2, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { slugify } from '@/lib/utils';

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

function isHotBadge(value?: string) {
  return String(value || '').trim().toLowerCase().includes('hot');
}

export default function UserAutomxhPage() {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const [sections, setSections] = useState<AutoMxhCatalogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      <div className="space-y-10 px-1 py-4 pb-20 sm:py-8">
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
        ) : groupedSections.length === 0 ? (
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
          groupedSections.map((group: AutoMxhGroupedSection) => (
            <section key={group.groupKey} className="category-section space-y-6 scroll-mt-28">
              <div className="mmo-section-title-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 shadow-sm dark:bg-white/5">
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
                        <div className="smm-service-card-3d group relative flex h-full flex-col overflow-hidden rounded-[1rem] border transition-all hover:border-brand-blue hover:shadow-xl">
                          {isHotBadge(product.badge) ? (
                            <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-rose-300/35 bg-gradient-to-r from-rose-500 to-orange-400 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_32px_-16px_rgba(251,113,133,0.9)]">
                              <Flame className="h-3 w-3" />
                              Hot
                            </div>
                          ) : product.badge ? (
                            <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-cyan-300/30 bg-cyan-500/12 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200 shadow-[0_12px_30px_-18px_rgba(34,211,238,0.8)]">
                              {product.badge}
                            </div>
                          ) : null}
                          <Link
                            href={`/user/automxh/order/${slugify(section.category.name)}?product=${product.id}`}
                            className="group/link flex flex-1 flex-col p-4"
                          >
                            <div className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 transition-transform duration-300 group-hover:scale-110 dark:bg-white/5">
                              <Zap className="h-5 w-5 text-orange-500" />
                            </div>

                            <h3 className="mb-2 text-[12px] font-black uppercase leading-tight text-slate-800 dark:text-white">
                              {product.name}
                            </h3>

                            <div className="mb-4">
                              <p className="line-clamp-2 text-[10px] italic text-slate-500">
                                {product.description || 'Cung cấp đa dạng các gói dịch vụ chất lượng cao.'}
                              </p>
                            </div>

                            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue transition-all duration-300 group-hover/link:bg-brand-blue group-hover/link:text-white">
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
          ))
        )}
      </div>
    </AppShell>
  );
}
