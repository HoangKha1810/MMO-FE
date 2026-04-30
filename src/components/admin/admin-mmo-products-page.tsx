'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  FolderInput,
  Loader2,
  Package,
  PackageOpen,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Input } from '@/components/ui/input';
import { EmptyState, MetricCard, SectionPanel } from '@/components/ui/page-layout';
import { cn, formatCurrency, formatNumber, toNumber } from '@/lib/utils';

type ProductRow = Record<string, unknown>;
type InventoryItem = Record<string, unknown>;

interface CategoryOption {
  id: number;
  name: string;
}

interface DashboardResponse {
  success: boolean;
  message?: string;
  data?: ProductRow[];
  categories?: CategoryOption[];
  stats?: {
    total_products: number;
    total_sales: number;
    total_revenue: number;
    today_sales: number;
  };
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface ProductFormValues {
  product_code: string;
  title: string;
  category_id: string;
  resource_type: string;
  price: string;
  original_price: string;
  sold_count: string;
  display_order: string;
  stock: string;
  featured: string;
  is_auto_margin: string;
  margin_percent: string;
  custom_badge: string;
  is_pinned: string;
  status: string;
  thumbnail: string;
  tags: string;
  api_provider_id: string;
  api_product_id: string;
  download_url: string;
  description: string;
  product_note: string;
  product_content: string;
  content: string;
}

type BulkDialogState =
  | null
  | { type: 'stats'; sold_count: string; stock: string }
  | { type: 'margin'; percent: string; auto_margin: boolean }
  | { type: 'category'; category_id: string };

interface InventoryModalState {
  product: ProductRow;
  loading: boolean;
  enabled: boolean;
  message: string;
  items: InventoryItem[];
  stats: {
    active: number;
    sold: number;
  };
  draft: string;
}

interface EditorState {
  mode: 'create' | 'edit';
  id?: number;
  values: ProductFormValues;
}

const LIMIT_OPTIONS = [10, 25, 50, 100, 200, 500, 9999];

function toText(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function toNumberId(value: unknown) {
  return Math.trunc(toNumber(value, 0));
}

function mergeIncomingRows(previous: ProductRow[], incoming: ProductRow[]) {
  const previousMap = new Map(previous.map((row) => [toNumberId(row.id), row] as const));
  return incoming.map((row) => {
    const id = toNumberId(row.id);
    if (!id) return row;
    const current = previousMap.get(id);
    if (!current) return row;
    return JSON.stringify(current) === JSON.stringify(row) ? current : { ...current, ...row };
  });
}

function keepSelectedRows(selected: number[], nextRows: ProductRow[]) {
  const nextIds = new Set(nextRows.map((row) => toNumberId(row.id)).filter(Boolean));
  return selected.filter((id) => nextIds.has(id));
}

function buildPaginationPages(page: number, totalPages: number) {
  const pages: Array<number | 'ellipsis'> = [];
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis');
  }

  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return pages;
}

function buildImageUrl(row: ProductRow) {
  const candidates = [row.category_image, row.category_icon, row.thumbnail]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return candidates[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(String(row.title || 'Resource'))}&background=2563eb&color=fff`;
}

function productStatusLabel(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active' ? 'ON' : 'OFF';
}

function buildEditorValues(row?: ProductRow): ProductFormValues {
  return {
    product_code: toText(row?.product_code),
    title: toText(row?.title),
    category_id: toText(row?.category_id),
    resource_type: toText(row?.resource_type || 'account'),
    price: toText(row?.price),
    original_price: toText(row?.original_price),
    sold_count: toText(row?.sold_count),
    display_order: toText(row?.display_order),
    stock: row?.stock === null || row?.stock === undefined ? '' : toText(row.stock),
    featured: toText(row?.featured ?? 0),
    is_auto_margin: toText(row?.is_auto_margin ?? 0),
    margin_percent: toText(row?.margin_percent ?? 0),
    custom_badge: toText(row?.custom_badge),
    is_pinned: toText(row?.is_pinned ?? 0),
    status: toText(row?.status || 'active'),
    thumbnail: toText(row?.thumbnail),
    tags: toText(row?.tags),
    api_provider_id: toText(row?.api_provider_id),
    api_product_id: toText(row?.api_product_id),
    download_url: toText(row?.download_url),
    description: toText(row?.description),
    product_note: toText(row?.product_note),
    product_content: toText(row?.product_content),
    content: toText(row?.content),
  };
}

export function AdminMmoProductsPage() {
  const { confirm } = useConfirmDialog();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [stats, setStats] = useState({
    total_products: 0,
    total_sales: 0,
    total_revenue: 0,
    today_sales: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    total_pages: 1,
  });
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState({
    search: '',
    category: '',
    status: '',
    stock_status: '',
    provider: '',
    limit: 50,
    page: 1,
  });
  const [loading, setLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [previewRow, setPreviewRow] = useState<ProductRow | null>(null);
  const [bulkDialog, setBulkDialog] = useState<BulkDialogState>(null);
  const [inventoryModal, setInventoryModal] = useState<InventoryModalState | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const paginationPages = useMemo(
    () => buildPaginationPages(pagination.page, pagination.total_pages),
    [pagination.page, pagination.total_pages]
  );
  const modalOpen = Boolean(editor || previewRow || bulkDialog || inventoryModal);

  async function loadData(
    nextQuery = query,
    options?: {
      silent?: boolean;
      merge?: boolean;
      preserveSelection?: boolean;
    }
  ) {
    if (options?.silent) {
      setBackgroundRefreshing(true);
    } else {
      setLoading(true);
    }

    const params = new URLSearchParams({
      page: String(nextQuery.page),
      limit: String(nextQuery.limit),
    });
    if (nextQuery.search.trim()) params.set('search', nextQuery.search.trim());
    if (nextQuery.category) params.set('category', nextQuery.category);
    if (nextQuery.status) params.set('status', nextQuery.status);
    if (nextQuery.stock_status) params.set('stock_status', nextQuery.stock_status);
    if (nextQuery.provider) params.set('provider', nextQuery.provider);

    try {
      const response = await fetch(`/api/admin/resources/products/dashboard?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload: DashboardResponse = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dữ liệu sản phẩm MMO');
      }

      const incomingRows = payload.data || [];
      setRows((current) => (options?.merge ? mergeIncomingRows(current, incomingRows) : incomingRows));
      setCategories(payload.categories || []);
      setStats(payload.stats || {
        total_products: 0,
        total_sales: 0,
        total_revenue: 0,
        today_sales: 0,
      });
      setPagination(payload.pagination || {
        page: nextQuery.page,
        per_page: nextQuery.limit,
        total: incomingRows.length,
        total_pages: 1,
      });
      setSelected((current) => (options?.preserveSelection ? keepSelectedRows(current, incomingRows) : []));
      setLastSyncedAt(new Date());
    } catch (error) {
      if (!options?.silent) {
        toast.error(error instanceof Error ? error.message : 'Không thể tải dữ liệu sản phẩm MMO');
      }
    } finally {
      if (options?.silent) {
        setBackgroundRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadData(query);
  }, [query]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!modalOpen && document.visibilityState === 'visible') {
        void loadData(query, { silent: true, merge: true, preserveSelection: true });
      }
    }, 20000);

    return () => window.clearInterval(timer);
  }, [modalOpen, query]);

  async function runAction(body: Record<string, unknown>, successMessage?: string) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/resources/products/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xử lý thao tác');
      }
      if (successMessage) {
        toast.success(successMessage);
      }
      await loadData(query, { preserveSelection: true });
      return payload;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý thao tác');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveEditor() {
    if (!editor) return;
    setSaving(true);
    try {
      const url = editor.mode === 'create'
        ? '/api/admin/resources/products'
        : `/api/admin/resources/products/${editor.id}`;
      const response = await fetch(url, {
        method: editor.mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor.values),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu sản phẩm MMO');
      }
      toast.success(editor.mode === 'create' ? 'Đã tạo sản phẩm mới' : 'Đã cập nhật sản phẩm');
      setEditor(null);
      await loadData(query);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu sản phẩm MMO');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: ProductRow) {
    const id = toNumberId(row.id);
    if (!id) return;

    const accepted = await confirm({
      title: `Ẩn sản phẩm #${id}?`,
      description: 'Sản phẩm sẽ chuyển sang trạng thái ẩn/tắt thay vì mất hẳn để bạn dễ rà soát lại sau.',
      confirmText: 'Ẩn sản phẩm',
      cancelText: 'Giữ lại',
      tone: 'danger',
    });
    if (!accepted) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/resources/products/${id}`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xóa sản phẩm');
      }
      toast.success('Đã ẩn sản phẩm');
      await loadData(query);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xóa sản phẩm');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRowStatus(row: ProductRow) {
    const id = toNumberId(row.id);
    if (!id) return;
    const nextStatus = String(row.status || '').trim().toLowerCase() === 'active' ? 'inactive' : 'active';
    await runAction({
      action: 'bulk-toggle-status',
      id,
      status: nextStatus,
    }, nextStatus === 'active' ? 'Đã bật sản phẩm' : 'Đã tắt sản phẩm');
  }

  async function submitBulkDialog() {
    if (!bulkDialog || selected.length === 0) return;
    if (bulkDialog.type === 'stats') {
      await runAction({
        action: 'bulk-update-stats',
        ids: selected,
        sold_count: bulkDialog.sold_count,
        stock: bulkDialog.stock,
      }, 'Đã cập nhật số liệu sản phẩm');
      setBulkDialog(null);
      return;
    }

    if (bulkDialog.type === 'margin') {
      await runAction({
        action: 'bulk-update-margin',
        ids: selected,
        percent: bulkDialog.percent,
        auto_margin: bulkDialog.auto_margin ? 'yes' : 'no',
      }, 'Đã cập nhật auto margin');
      setBulkDialog(null);
      return;
    }

    if (bulkDialog.type === 'category') {
      await runAction({
        action: 'bulk-update-category',
        ids: selected,
        category_id: bulkDialog.category_id,
      }, 'Đã cập nhật danh mục sản phẩm');
      setBulkDialog(null);
    }
  }

  async function openInventory(row: ProductRow) {
    setInventoryModal({
      product: row,
      loading: true,
      enabled: false,
      message: '',
      items: [],
      stats: { active: 0, sold: 0 },
      draft: '',
    });

    try {
      const response = await fetch(`/api/admin/resources/products/inventory?resource_id=${toNumberId(row.id)}`, {
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải kho sản phẩm');
      }
      setInventoryModal((current) => current ? {
        ...current,
        loading: false,
        enabled: Boolean(payload.enabled),
        message: String(payload.message || ''),
        items: Array.isArray(payload.items) ? payload.items : [],
        stats: payload.stats || { active: 0, sold: 0 },
      } : current);
    } catch (error) {
      setInventoryModal((current) => current ? {
        ...current,
        loading: false,
        enabled: false,
        message: error instanceof Error ? error.message : 'Không thể tải kho sản phẩm',
      } : current);
    }
  }

  async function refreshInventory(resourceId: number) {
    const response = await fetch(`/api/admin/resources/products/inventory?resource_id=${resourceId}`, {
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Không thể tải kho sản phẩm');
    }

    setInventoryModal((current) => current ? {
      ...current,
      loading: false,
      enabled: Boolean(payload.enabled),
      message: String(payload.message || ''),
      items: Array.isArray(payload.items) ? payload.items : [],
      stats: payload.stats || { active: 0, sold: 0 },
    } : current);
  }

  async function mutateInventory(body: Record<string, unknown>, successMessage: string) {
    if (!inventoryModal) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/resources/products/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật kho sản phẩm');
      }
      toast.success(successMessage);
      await refreshInventory(toNumberId(inventoryModal.product.id));
      await loadData(query, { preserveSelection: true });
      return payload;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật kho sản phẩm');
      return null;
    } finally {
      setSaving(false);
    }
  }

  const allSelected = rows.length > 0 && selected.length === rows.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tổng sản phẩm"
          value={formatNumber(stats.total_products)}
          hint="Kho MMO đang hiển thị"
          tone="blue"
          icon={<Package className="h-4 w-4" />}
        />
        <MetricCard
          label="Tổng đơn hàng"
          value={formatNumber(stats.total_sales)}
          hint="Số đơn đã hoàn tất"
          tone="emerald"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <MetricCard
          label="Đơn hôm nay"
          value={formatNumber(stats.today_sales)}
          hint="Hoàn tất trong ngày"
          tone="amber"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Tổng doanh thu"
          value={formatCurrency(stats.total_revenue)}
          hint="Doanh thu tài nguyên"
          tone="violet"
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <SectionPanel className="overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white p-0 shadow-sm dark:border-white/10 dark:bg-[#090d17]">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-white/5">
          <div className="flex flex-col items-start gap-4 xl:flex-row xl:items-center">
            <div className="mr-auto">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                Administration
              </div>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">
                Quản lý sản phẩm MMO
              </h1>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-center">
              <div className="relative min-w-[280px] xl:min-w-[320px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      setQuery((current) => ({
                        ...current,
                        search: searchInput.trim(),
                        page: 1,
                      }));
                    }
                  }}
                  placeholder="Tìm tên hoặc mã SP..."
                  className="pl-10"
                />
              </div>

              <div className="field-elevated flex h-11 items-center gap-2 rounded-[1rem] px-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                <span>Hiển thị</span>
                <select
                  value={String(query.limit)}
                  onChange={(event) => setQuery((current) => ({
                    ...current,
                    limit: Number(event.target.value),
                    page: 1,
                  }))}
                  className="bg-transparent text-[11px] font-black uppercase tracking-[0.16em] text-slate-700 outline-none dark:text-white"
                >
                  {LIMIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option > 1000 ? 'Tất cả' : `${option} dòng`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1.5">
                  {paginationPages.map((page, index) => page === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-xs font-black text-slate-400">...</span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setQuery((current) => ({ ...current, page }))}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-black transition-all',
                        page === pagination.page
                          ? 'border-brand-blue bg-brand-blue text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.85)]'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-brand-blue hover:bg-brand-blue hover:text-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-brand-blue dark:hover:bg-brand-blue dark:hover:text-white'
                      )}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void runAction({ action: 'sync' }, 'Đã đồng bộ dữ liệu provider MMO');
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] bg-amber-500 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_34px_-22px_rgba(245,158,11,0.88)] transition-all hover:bg-amber-600 disabled:opacity-60"
              >
                <RefreshCw className={cn('h-4 w-4', saving && 'animate-spin')} />
                Đồng bộ API
              </button>
              <button
                type="button"
                onClick={() => setEditor({ mode: 'create', values: buildEditorValues() })}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] bg-brand-blue px-5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_34px_-22px_rgba(37,99,235,0.88)] transition-all hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                Thêm
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="flex flex-wrap items-center gap-4 xl:gap-6">
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Danh mục:</span>
              <select
                value={query.category}
                onChange={(event) => setQuery((current) => ({ ...current, category: event.target.value, page: 1 }))}
                className="field-elevated h-10 min-w-[180px] rounded-[0.95rem] px-3 text-[11px] font-bold text-slate-700 outline-none dark:text-white"
              >
                <option value="">Tất cả</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Trạng thái:</span>
              <select
                value={query.status}
                onChange={(event) => setQuery((current) => ({ ...current, status: event.target.value, page: 1 }))}
                className="field-elevated h-10 min-w-[150px] rounded-[0.95rem] px-3 text-[11px] font-bold text-slate-700 outline-none dark:text-white"
              >
                <option value="">Tất cả</option>
                <option value="active">Đang bán</option>
                <option value="inactive">Tạm ẩn</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Kho hàng:</span>
              <select
                value={query.stock_status}
                onChange={(event) => setQuery((current) => ({ ...current, stock_status: event.target.value, page: 1 }))}
                className="field-elevated h-10 min-w-[150px] rounded-[0.95rem] px-3 text-[11px] font-bold text-slate-700 outline-none dark:text-white"
              >
                <option value="">Tất cả</option>
                <option value="in_stock">Còn hàng</option>
                <option value="low_stock">Sắp hết (&lt; 10)</option>
                <option value="out_of_stock">Hết hàng</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Nguồn:</span>
              <select
                value={query.provider}
                onChange={(event) => setQuery((current) => ({ ...current, provider: event.target.value, page: 1 }))}
                className="field-elevated h-10 min-w-[140px] rounded-[0.95rem] px-3 text-[11px] font-bold text-slate-700 outline-none dark:text-white"
              >
                <option value="">Tất cả</option>
                <option value="local">Local</option>
                <option value="api">API</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setQuery({
                  search: '',
                  category: '',
                  status: '',
                  stock_status: '',
                  provider: '',
                  limit: query.limit,
                  page: 1,
                });
              }}
              className="ml-auto inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-rose-500 transition-colors hover:text-rose-600"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Xóa lọc
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-4">
          <Badge variant="muted" className="rounded-lg px-3 py-1.5">
            Tổng {formatNumber(pagination.total)} dòng
          </Badge>
          <Badge variant="muted" className="rounded-lg px-3 py-1.5">
            Trang {pagination.page}/{pagination.total_pages}
          </Badge>
          <Badge variant={selected.length > 0 ? 'info' : 'muted'} className="rounded-lg px-3 py-1.5">
            Đã chọn {selected.length}
          </Badge>
          <Badge variant={backgroundRefreshing ? 'info' : 'muted'} className="rounded-lg px-3 py-1.5">
            {backgroundRefreshing
              ? 'Đang đồng bộ nền...'
              : lastSyncedAt
                ? `Cập nhật ${lastSyncedAt.toLocaleTimeString('vi-VN')}`
                : 'Chưa đồng bộ'}
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left">
            <thead className="border-y border-slate-100 text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 dark:border-white/5 dark:text-slate-500">
              <tr>
                <th className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => {
                      setSelected(event.target.checked ? rows.map((row) => toNumberId(row.id)).filter(Boolean) : []);
                    }}
                    className="h-4 w-4 rounded border-slate-300 dark:border-white/10 dark:bg-slate-900"
                  />
                </th>
                <th className="px-4 py-4">ID / Code</th>
                <th className="px-4 py-4">Sản phẩm</th>
                <th className="px-4 py-4">Danh mục</th>
                <th className="px-4 py-4">Giá API gốc</th>
                <th className="px-4 py-4">Giá đăng bán</th>
                <th className="px-4 py-4">Lợi nhuận</th>
                <th className="px-4 py-4 text-center">Kho / Đã bán</th>
                <th className="px-4 py-4 text-center">Trạng thái</th>
                <th className="px-4 py-4 text-center">Thứ tự</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-20 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                    Đang tải danh sách sản phẩm...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-0">
                    <EmptyState
                      title="Chưa có sản phẩm MMO"
                      description="Bộ lọc hiện tại chưa trả về sản phẩm nào. Bạn có thể đổi điều kiện, đồng bộ lại API hoặc tạo mới sản phẩm."
                      className="rounded-none border-0 shadow-none"
                    />
                  </td>
                </tr>
              ) : rows.map((row) => {
                const id = toNumberId(row.id);
                const originalPrice = toNumber(row.original_price, 0);
                const price = toNumber(row.price, 0);
                const profit = price - originalPrice;
                const profitPercent = originalPrice > 0 ? (profit / originalPrice) * 100 : 0;
                const stock = row.stock === null || row.stock === undefined ? null : toNumber(row.stock, 0);
                const isActive = String(row.status || '').trim().toLowerCase() === 'active';
                const autoMargin = toNumber(row.is_auto_margin, 0) === 1;

                return (
                  <tr key={id} className="transition-all hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-5">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(id)}
                        onChange={() => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                        className="h-4 w-4 rounded border-slate-300 dark:border-white/10 dark:bg-slate-900"
                      />
                    </td>
                    <td className="px-4 py-5">
                      <div className="text-[10px] font-black uppercase leading-none text-brand-blue">
                        #{formatNumber(id)}
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-slate-400">
                        {toText(row.product_code) || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-start gap-3">
                        <img
                          src={buildImageUrl(row)}
                          alt={toText(row.title) || 'Resource'}
                          className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200 shadow-sm dark:ring-white/10"
                        />
                        <div className="min-w-0">
                          <div className="line-clamp-3 text-sm font-black leading-7 text-slate-900 dark:text-white">
                            {toText(row.title)}
                          </div>
                          <div className="mt-1 line-clamp-1 text-[10px] font-semibold text-slate-400">
                            {toText(row.description) || 'Không có mô tả ngắn'}
                          </div>
                          {autoMargin ? (
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-500">
                                Auto Margin ({toText(row.margin_percent) || '0'}%)
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-sm font-bold leading-7 text-slate-500 dark:text-slate-300">
                      {toText(row.category_name || row.category) || 'Khác'}
                    </td>
                    <td className="px-4 py-5">
                      <div className="text-sm font-bold text-slate-500 dark:text-slate-300">
                        {originalPrice > 0 ? formatCurrency(originalPrice) : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-5 text-sm font-black text-brand-blue">
                      {formatCurrency(price)}
                    </td>
                    <td className="px-4 py-5">
                      <div className={cn(
                        'text-xs font-black',
                        profit > 0 ? 'text-emerald-500' : profit < 0 ? 'text-rose-500' : 'text-slate-400'
                      )}>
                        {`${profit > 0 ? '+' : ''}${formatNumber(profit)}`}₫
                      </div>
                      <div className="mt-1 text-[9px] font-bold text-slate-400">
                        ({`${profit > 0 ? '+' : ''}${profitPercent.toFixed(1)}`}%)
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        {stock === null ? '∞' : formatNumber(stock)}
                      </div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Đã bán: <span className="text-brand-blue">{formatNumber(toNumber(row.sold_count, 0))}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => { void toggleRowStatus(row); }}
                          className={cn(
                            'relative inline-flex h-5 w-10 items-center rounded-full transition-colors',
                            isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                              isActive ? 'translate-x-5' : 'translate-x-0.5'
                            )}
                          />
                        </button>
                        <span className={cn(
                          'rounded-lg px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em]',
                          isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'
                        )}>
                          {productStatusLabel(row.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <input
                        type="number"
                        defaultValue={toText(row.display_order || 0)}
                        onBlur={(event) => {
                          const value = event.currentTarget.value.trim();
                          if (!value || value === toText(row.display_order || 0)) return;
                          void runAction(
                            {
                              action: 'update-display-order',
                              id,
                              display_order: value,
                            },
                            'Đã cập nhật thứ tự hiển thị'
                          );
                        }}
                        className="h-10 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-[11px] font-black text-slate-700 outline-none transition-all focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewRow(row)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/5 text-slate-500 transition-all hover:bg-slate-500 hover:text-white"
                          title="Xem nhanh"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { void openInventory(row); }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/5 text-emerald-500 transition-all hover:bg-emerald-500 hover:text-white"
                          title="Quản lý kho"
                        >
                          <PackageOpen className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditor({ mode: 'edit', id, values: buildEditorValues(row) })}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/5 text-blue-500 transition-all hover:bg-blue-500 hover:text-white"
                          title="Sửa"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { void deleteRow(row); }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/5 text-rose-500 transition-all hover:bg-rose-500 hover:text-white"
                          title="Ẩn sản phẩm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/30 px-6 py-4 text-xs font-bold text-slate-500 md:flex-row md:items-center md:justify-between dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
          <span>Đang xem {formatNumber(rows.length)} sản phẩm trên trang này</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Trước
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
            >
              Sau
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </SectionPanel>

      <div
        className={cn(
          'fixed bottom-6 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-6 rounded-[12px] border border-slate-700/50 bg-slate-900 px-6 py-3.5 shadow-2xl transition-all duration-300',
          selected.length > 0
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-32 opacity-0'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-white">
            <span className="text-xs font-black">{selected.length}</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
            Sản phẩm
            <br />
            <span className="font-bold text-slate-500">được chọn</span>
          </div>
        </div>
        <div className="h-8 w-px bg-slate-700" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { void runAction({ action: 'bulk-toggle-status', ids: selected, status: 'active' }, 'Đã bật các sản phẩm đã chọn'); }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-emerald-600"
          >
            <Power className="h-4 w-4" />
            Bật
          </button>
          <button
            type="button"
            onClick={() => { void runAction({ action: 'bulk-toggle-status', ids: selected, status: 'inactive' }, 'Đã tắt các sản phẩm đã chọn'); }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-700"
          >
            <PowerOff className="h-4 w-4" />
            Tắt
          </button>
          <button
            type="button"
            onClick={() => setBulkDialog({ type: 'stats', sold_count: '', stock: '' })}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-amber-600"
          >
            <Pencil className="h-4 w-4" />
            Sửa SL
          </button>
          <button
            type="button"
            onClick={() => setBulkDialog({ type: 'margin', percent: '20', auto_margin: true })}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-600"
          >
            <Zap className="h-4 w-4" />
            Auto Margin
          </button>
          <button
            type="button"
            onClick={() => { void runAction({ action: 'bulk-duplicate', ids: selected }, 'Đã nhân bản sản phẩm đã chọn'); }}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-violet-600"
          >
            <Copy className="h-4 w-4" />
            Nhân bản
          </button>
          <button
            type="button"
            onClick={() => setBulkDialog({ type: 'category', category_id: '' })}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-blue-600"
          >
            <FolderInput className="h-4 w-4" />
            Đổi DM
          </button>
          <button
            type="button"
            onClick={() => { void runAction({ action: 'bulk-delete', ids: selected }, 'Đã ẩn các sản phẩm đã chọn'); }}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-rose-600"
          >
            <Trash2 className="h-4 w-4" />
            Xóa
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {editor ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0a0f1b]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                  Administration
                </div>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">
                  {editor.mode === 'create' ? 'Thêm sản phẩm MMO' : `Sửa #${formatNumber(editor.id || 0)}`}
                </h2>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditor(null)}>
                Đóng
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Tiêu đề sản phẩm"
                value={editor.values.title}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, title: value } } : current)}
                className="md:col-span-2"
              />
              <Field
                label="Mã sản phẩm"
                value={editor.values.product_code}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, product_code: value } } : current)}
              />
              <SelectField
                label="Danh mục"
                value={editor.values.category_id}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, category_id: value } } : current)}
                options={[
                  { value: '', label: 'Chọn danh mục' },
                  ...categories.map((category) => ({ value: String(category.id), label: category.name })),
                ]}
              />
              <SelectField
                label="Loại tài nguyên"
                value={editor.values.resource_type}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, resource_type: value } } : current)}
                options={[
                  { value: 'account', label: 'Tài khoản / Clone' },
                  { value: 'tool', label: 'Tool / Phần mềm' },
                  { value: 'api', label: 'API / Key' },
                  { value: 'other', label: 'Khác' },
                ]}
              />
              <Field
                label="Giá bán"
                type="number"
                value={editor.values.price}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, price: value } } : current)}
              />
              <Field
                label="Giá API gốc"
                type="number"
                value={editor.values.original_price}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, original_price: value } } : current)}
              />
              <Field
                label="Đã bán (ảo)"
                type="number"
                value={editor.values.sold_count}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, sold_count: value } } : current)}
              />
              <Field
                label="Thứ tự hiển thị"
                type="number"
                value={editor.values.display_order}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, display_order: value } } : current)}
              />
              <Field
                label="Số lượng kho"
                type="number"
                value={editor.values.stock}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, stock: value } } : current)}
              />
              <SelectField
                label="Nổi bật"
                value={editor.values.featured}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, featured: value } } : current)}
                options={[
                  { value: '0', label: 'Không' },
                  { value: '1', label: 'Có' },
                ]}
              />
              <SelectField
                label="Bật Auto Margin"
                value={editor.values.is_auto_margin}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, is_auto_margin: value } } : current)}
                options={[
                  { value: '0', label: 'Không' },
                  { value: '1', label: 'Có' },
                ]}
              />
              <Field
                label="Margin (%)"
                type="number"
                value={editor.values.margin_percent}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, margin_percent: value } } : current)}
              />
              <SelectField
                label="Nhãn badge"
                value={editor.values.custom_badge}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, custom_badge: value } } : current)}
                options={[
                  { value: '', label: 'Tự động' },
                  { value: 'HOT', label: 'HOT' },
                  { value: 'BÁN CHẠY', label: 'BÁN CHẠY' },
                  { value: 'ĐỘC QUYỀN', label: 'ĐỘC QUYỀN' },
                  { value: 'MỚI', label: 'MỚI' },
                ]}
              />
              <SelectField
                label="Ghim sản phẩm"
                value={editor.values.is_pinned}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, is_pinned: value } } : current)}
                options={[
                  { value: '0', label: 'Không' },
                  { value: '1', label: 'Có' },
                ]}
              />
              <SelectField
                label="Trạng thái"
                value={editor.values.status}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, status: value } } : current)}
                options={[
                  { value: 'active', label: 'Đang bán' },
                  { value: 'inactive', label: 'Tạm ẩn' },
                ]}
              />
              <Field
                label="API Provider ID"
                value={editor.values.api_provider_id}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, api_provider_id: value } } : current)}
              />
              <Field
                label="API Product ID"
                value={editor.values.api_product_id}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, api_product_id: value } } : current)}
              />
              <Field
                label="Thumbnail URL"
                value={editor.values.thumbnail}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, thumbnail: value } } : current)}
                className="md:col-span-2"
              />
              <Field
                label="Download URL"
                value={editor.values.download_url}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, download_url: value } } : current)}
                className="md:col-span-2"
              />
              <Field
                label="Tags"
                value={editor.values.tags}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, tags: value } } : current)}
                className="md:col-span-2"
              />
              <TextareaField
                label="Mô tả ngắn"
                value={editor.values.description}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, description: value } } : current)}
                className="md:col-span-2"
                rows={3}
              />
              <TextareaField
                label="Lưu ý mua hàng"
                value={editor.values.product_note}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, product_note: value } } : current)}
                className="md:col-span-2"
                rows={3}
              />
              <TextareaField
                label="Nội dung sản phẩm"
                value={editor.values.product_content}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, product_content: value } } : current)}
                className="md:col-span-2"
                rows={5}
              />
              <TextareaField
                label="Content nội bộ"
                value={editor.values.content}
                onChange={(value) => setEditor((current) => current ? { ...current, values: { ...current.values, content: value } } : current)}
                className="md:col-span-2"
                rows={4}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                Hủy
              </Button>
              <Button type="button" loading={saving} onClick={() => { void saveEditor(); }}>
                <Save className="mr-2 h-4 w-4" />
                Lưu sản phẩm
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {previewRow ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0a0f1b]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                  Thông tin chi tiết
                </div>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">
                  {toText(previewRow.title)}
                </h2>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setPreviewRow(null)}>
                Đóng
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Giá bán</div>
                <div className="mt-2 text-2xl font-black text-brand-blue">{formatCurrency(toNumber(previewRow.price, 0))}</div>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Kho hiện tại</div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {previewRow.stock === null || previewRow.stock === undefined ? '∞' : formatNumber(toNumber(previewRow.stock, 0))}
                </div>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04] md:col-span-2">
                <div className="grid gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  <div>Mã SP: <span className="font-black text-slate-900 dark:text-white">{toText(previewRow.product_code) || 'N/A'}</span></div>
                  <div>Danh mục: <span className="font-black text-slate-900 dark:text-white">{toText(previewRow.category_name || previewRow.category) || 'Khác'}</span></div>
                  <div>Provider: <span className="font-black text-slate-900 dark:text-white">{toText(previewRow.api_provider_id) || 'Local'}</span></div>
                  <div>API Product: <span className="font-black text-slate-900 dark:text-white">{toText(previewRow.api_product_id) || '—'}</span></div>
                  <div>Đã bán: <span className="font-black text-slate-900 dark:text-white">{formatNumber(toNumber(previewRow.sold_count, 0))}</span></div>
                  <div>Auto Margin: <span className="font-black text-slate-900 dark:text-white">{toNumber(previewRow.is_auto_margin, 0) === 1 ? `Bật (${toText(previewRow.margin_percent)}%)` : 'Tắt'}</span></div>
                </div>
              </div>
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04] md:col-span-2">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Mô tả</div>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                  {toText(previewRow.description) || 'Không có mô tả'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDialog ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0a0f1b]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                  Bulk action
                </div>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">
                  {bulkDialog.type === 'stats'
                    ? 'Cập nhật nhanh SL'
                    : bulkDialog.type === 'margin'
                      ? `Auto Margin cho ${selected.length} sản phẩm`
                      : 'Đổi danh mục hàng loạt'}
                </h2>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setBulkDialog(null)}>
                Đóng
              </Button>
            </div>

            {bulkDialog.type === 'stats' ? (
              <div className="grid gap-4">
                <Field
                  label="Số lượng đã bán (ảo)"
                  type="number"
                  value={bulkDialog.sold_count}
                  onChange={(value) => setBulkDialog((current) => current?.type === 'stats' ? { ...current, sold_count: value } : current)}
                />
                <Field
                  label="Số lượng kho"
                  type="number"
                  value={bulkDialog.stock}
                  onChange={(value) => setBulkDialog((current) => current?.type === 'stats' ? { ...current, stock: value } : current)}
                />
              </div>
            ) : null}

            {bulkDialog.type === 'margin' ? (
              <div className="grid gap-4">
                <Field
                  label="Tỷ lệ lợi nhuận (%)"
                  type="number"
                  value={bulkDialog.percent}
                  onChange={(value) => setBulkDialog((current) => current?.type === 'margin' ? { ...current, percent: value } : current)}
                />
                <label className="rounded-[1.1rem] border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-400/20 dark:bg-indigo-500/[0.08]">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={bulkDialog.auto_margin}
                      onChange={(event) => setBulkDialog((current) => current?.type === 'margin' ? { ...current, auto_margin: event.target.checked } : current)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
                        Bật Auto Margin
                      </div>
                      <p className="mt-1 text-sm font-medium text-indigo-500 dark:text-indigo-200/80">
                        Giá bán mới = Giá API gốc × (1 + phần trăm / 100)
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            ) : null}

            {bulkDialog.type === 'category' ? (
              <div className="grid gap-4">
                <SelectField
                  label="Danh mục mới"
                  value={bulkDialog.category_id}
                  onChange={(value) => setBulkDialog((current) => current?.type === 'category' ? { ...current, category_id: value } : current)}
                  options={[
                    { value: '', label: 'Chọn danh mục' },
                    ...categories.map((category) => ({ value: String(category.id), label: category.name })),
                  ]}
                />
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setBulkDialog(null)}>
                Hủy
              </Button>
              <Button type="button" loading={saving} onClick={() => { void submitBulkDialog(); }}>
                Thực hiện
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {inventoryModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0a0f1b]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                  Quản lý kho
                </div>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">
                  {toText(inventoryModal.product.title)}
                </h2>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setInventoryModal(null)}>
                Đóng
              </Button>
            </div>

            {inventoryModal.loading ? (
              <div className="py-20 text-center text-slate-400">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                Đang tải kho hàng...
              </div>
            ) : !inventoryModal.enabled ? (
              <EmptyState
                title="Kho hàng chưa sẵn sàng"
                description={inventoryModal.message || 'Database chưa có bảng mmo_resource_items nên chưa bật được luồng quản lý kho chi tiết.'}
              />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/[0.08]">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">Sẵn sàng</div>
                    <div className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-200">
                      {formatNumber(inventoryModal.stats.active)}
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Đã bán</div>
                    <div className="mt-2 text-3xl font-black text-slate-800 dark:text-white">
                      {formatNumber(inventoryModal.stats.sold)}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.3rem] border border-dashed border-slate-300 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Thêm tài khoản mới</div>
                  <textarea
                    rows={6}
                    value={inventoryModal.draft}
                    onChange={(event) => setInventoryModal((current) => current ? { ...current, draft: event.target.value } : current)}
                    placeholder="Mỗi dòng một item. Ví dụ: email|pass|2fa"
                    className="mt-3 min-h-[150px] w-full rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                  />
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving || inventoryModal.stats.sold === 0}
                      onClick={() => {
                        void mutateInventory({
                          action: 'clear-sold',
                          resource_id: toNumberId(inventoryModal.product.id),
                        }, 'Đã dọn toàn bộ item đã bán');
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Dọn sold
                    </Button>
                    <Button
                      type="button"
                      loading={saving}
                      disabled={!inventoryModal.draft.trim()}
                      onClick={() => {
                        void mutateInventory({
                          action: 'add-items',
                          resource_id: toNumberId(inventoryModal.product.id),
                          content: inventoryModal.draft,
                        }, 'Đã thêm item vào kho').then((result) => {
                          if (result) {
                            setInventoryModal((current) => current ? { ...current, draft: '' } : current);
                          }
                        });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Thêm vào kho
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.3rem] border border-slate-200 dark:border-white/10">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:border-white/5 dark:bg-white/[0.04] dark:text-slate-500">
                        <tr>
                          <th className="px-4 py-3">ID</th>
                          <th className="px-4 py-3">Nội dung</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {inventoryModal.items.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-16 text-center text-slate-400">
                              Chưa có item trong kho này.
                            </td>
                          </tr>
                        ) : inventoryModal.items.map((item) => (
                          <tr key={toNumberId(item.id)} className="align-top">
                            <td className="px-4 py-4 text-sm font-black text-brand-blue">
                              #{formatNumber(toNumberId(item.id))}
                            </td>
                            <td className="px-4 py-4">
                              <div className="max-w-[520px] whitespace-pre-wrap break-all font-mono text-sm font-semibold leading-7 text-slate-700 dark:text-slate-200">
                                {toText(item.content)}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Badge variant={String(item.status || '') === 'active' ? 'info' : 'muted'} className="rounded-full px-3 py-1.5">
                                {toText(item.status) || 'unknown'}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={saving}
                                onClick={() => {
                                  void mutateInventory({
                                    action: 'delete-item',
                                    item_id: toNumberId(item.id),
                                  }, 'Đã xóa item khỏi kho');
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Xóa item
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  type?: string;
}) {
  return (
    <label className={cn('space-y-2', className)}>
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-bold text-slate-700 outline-none dark:text-white"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  className,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rows?: number;
}) {
  return (
    <label className={cn('space-y-2', className)}>
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-elevated min-h-[120px] w-full rounded-[1rem] px-4 py-3 text-sm font-semibold text-slate-700 outline-none dark:text-white"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label className={cn('space-y-2', className)}>
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-bold text-slate-700 outline-none dark:text-white"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
