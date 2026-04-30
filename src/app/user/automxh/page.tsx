'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Zap } from 'lucide-react';
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
  min_price: number;
  variant_count: number;
}

interface AutoMxhCatalogSection {
  category: AutoMxhCategory;
  products: AutoMxhProduct[];
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

export default function UserAutomxhPage() {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const [sections, setSections] = useState<AutoMxhCatalogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm font-bold text-rose-500">
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
        ) : sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
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
          sections.map((section) => (
            <section key={section.category.id} className="category-section space-y-5 scroll-mt-28">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 shadow-sm dark:bg-white/5">
                    {section.category.gif ? (
                      <img src={assetUrl(section.category.gif)} className="h-6 w-6 object-contain" alt="" />
                    ) : (
                      <Zap className="h-5 w-5 text-orange-500" />
                    )}
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    {section.category.name}
                  </h2>
                </div>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-400 dark:bg-white/5">
                  {section.products.length} dịch vụ
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {section.products.map((product) => (
                  <div key={product.id} className="service-card-wrapper h-full">
                    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white transition-all hover:border-brand-blue hover:shadow-xl dark:border-white/10 dark:bg-slate-900/50">
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
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
