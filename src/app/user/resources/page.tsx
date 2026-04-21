'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Boxes, Filter, Loader2, Package, Search, ShoppingCart, Sparkles, Store } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatCurrency } from '@/lib/utils';

interface ResourceItem {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  price: number;
  stock: number;
  sold_count: number;
  status: string;
  thumbnail?: string | null;
  category_name?: string | null;
  custom_badge?: string | null;
}

export default function ResourcesPage() {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const [search, setSearch] = useState('');
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingCart, setLoadingCart] = useState<number | null>(null);

  async function loadResources(keyword = search) {
    setLoadingPage(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set('search', keyword.trim());
      const response = await fetch(`/api/resources?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải tài nguyên');
      }
      setResources(payload.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải tài nguyên');
    } finally {
      setLoadingPage(false);
    }
  }

  useEffect(() => {
    void loadResources('');
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(resources.map((item) => item.category).filter(Boolean))),
    [resources]
  );
  const resourceStats = useMemo(
    () => ({
      total: resources.length,
      sold: resources.reduce((sum, item) => sum + (item.sold_count || 0), 0),
      stock: resources.reduce((sum, item) => sum + (item.stock || 0), 0),
    }),
    [resources]
  );

  async function handleAddToCart(id: number) {
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return;
    }
    setLoadingCart(id);
    try {
      const response = await fetch('/api/user/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: id, quantity: 1 }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể thêm vào giỏ hàng');
      }
      toast.success('Đã thêm vào giỏ hàng');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể thêm vào giỏ hàng');
    } finally {
      setLoadingCart(null);
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="MMO Resources"
          title="Kho tài nguyên MMO sẵn sàng khai thác"
          description="Khám phá nguồn tài nguyên số của TRUNGTAMMMO với thông tin tồn kho, giá bán và trạng thái mở bán rõ ràng để chọn mua nhanh và an toàn."
          stats={[
            { label: 'Danh mục', value: String(categories.length || 0), hint: 'Nhóm sản phẩm đang hiển thị', tone: 'blue' },
            { label: 'Tài nguyên', value: String(resourceStats.total), hint: 'Sản phẩm đang bật bán', tone: 'emerald' },
            { label: 'Đã bán', value: String(resourceStats.sold), hint: 'Tổng lượt mua ghi nhận', tone: 'amber' },
            { label: 'Tồn kho', value: String(resourceStats.stock), hint: 'Số item còn có thể xuất', tone: 'violet' },
          ]}
          actions={
            <>
              <Badge variant="info" className="rounded-full px-3 py-1.5">Kho đang mở</Badge>
              <Badge variant="muted" className="rounded-full px-3 py-1.5">Mua và nhận sau thanh toán</Badge>
            </>
          }
        />

        <SectionPanel>
          <SectionHeader
            eyebrow="Catalog"
            title="Tìm nhanh sản phẩm phù hợp"
            description="Lọc theo từ khóa để tìm đúng bộ tài nguyên, nguồn hàng và mặt hàng phù hợp với nhu cầu kinh doanh của bạn."
          />

          <form
            className="mt-6 flex flex-col gap-3 xl:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void loadResources();
            }}
          >
            <div className="relative max-w-2xl flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm kiếm tài nguyên, keyword, source..."
                className="pl-11"
              />
            </div>
            <Button type="submit" disabled={loadingPage} loading={loadingPage} loadingText="Đang lọc...">
              <Filter className="mr-2 h-4 w-4" />
              Lọc tài nguyên
            </Button>
          </form>

          {categories.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {categories.slice(0, 12).map((category) => (
                <Badge key={category} variant="muted" className="rounded-full px-3 py-1.5">
                  {category}
                </Badge>
              ))}
            </div>
          ) : null}
        </SectionPanel>

        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Live Inventory"
            title="Sản phẩm đang mở bán"
            description="Danh sách mở bán hiển thị rõ danh mục, tồn kho, giá và hành động mua để bạn ra quyết định nhanh hơn."
            actions={
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted" className="rounded-full px-3 py-1.5">
                  <Boxes className="h-3 w-3" />
                  {resourceStats.total} item
                </Badge>
                <Badge variant="muted" className="rounded-full px-3 py-1.5">
                  <Store className="h-3 w-3" />
                  Kho thật
                </Badge>
              </div>
            }
          />

          {loadingPage ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Đang tải tài nguyên
            </div>
          ) : resources.length === 0 ? (
            <EmptyState
              title="Chưa có tài nguyên đang bật"
              description="Hiện chưa có tài nguyên phù hợp với bộ lọc hiện tại. Hãy thử từ khóa khác hoặc quay lại khi kho được cập nhật thêm."
              icon={<Package className="h-5 w-5" />}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {resources.map((resource) => (
                <article
                  key={resource.id}
                  className="surface-card group rounded-[1.75rem] p-5 md:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-[1.4rem] border border-brand-blue/15 bg-gradient-to-br from-brand-blue/15 via-sky-500/10 to-emerald-500/10 text-brand-blue shadow-sm transition-transform duration-300 group-hover:scale-105">
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant="info" className="rounded-full px-3 py-1.5 text-[9px]">
                        {resource.category_name || resource.category || 'Khác'}
                      </Badge>
                      {resource.custom_badge ? (
                        <Badge variant="warning" className="rounded-full px-3 py-1.5 text-[9px]">
                          <Sparkles className="h-3 w-3" />
                          {resource.custom_badge}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <Link
                      href={`/user/resources/${resource.id}`}
                      className="block text-lg font-black uppercase leading-tight tracking-[-0.04em] text-slate-950 transition hover:text-brand-blue dark:text-white"
                    >
                      {resource.title}
                    </Link>
                    {resource.description ? (
                      <p className="line-clamp-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                        {resource.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-2 text-center min-[430px]:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Đã bán</div>
                      <div className="mt-2 font-mono text-lg font-black text-slate-950 dark:text-white">
                        {resource.sold_count || 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Kho</div>
                      <div className="mt-2 font-mono text-lg font-black text-slate-950 dark:text-white">
                        {resource.stock}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Status</div>
                      <div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-500">
                        {resource.status}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 border-t border-slate-200/70 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-[0.26em] text-slate-400">Giá bán</div>
                      <div className="mt-2 font-mono text-2xl font-black text-brand-blue">
                        {formatCurrency(resource.price)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleAddToCart(resource.id)}
                      disabled={loadingCart === resource.id || resource.stock <= 0}
                      loading={loadingCart === resource.id}
                      loadingText="Đang thêm"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {resource.stock > 0 ? 'Thêm vào giỏ' : 'Hết hàng'}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
