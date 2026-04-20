'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Bolt,
  CheckCircle2,
  CreditCard,
  Gamepad2,
  Headset,
  Layers3,
  Megaphone,
  Package,
  RefreshCw,
  Save,
  Search,
  Server,
  SlidersHorizontal,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { cn, formatCurrency, formatNumber, toNumber } from '@/lib/utils';

type PricingFieldKind = 'money' | 'percent' | 'number';

interface PricingField {
  key: string;
  label: string;
  kind: PricingFieldKind;
  editable: boolean;
  primary?: boolean;
  hint?: string;
}

interface PricingModule {
  key: string;
  label: string;
  description: string;
  icon: string;
  tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan' | 'slate';
  count: number;
  fields: PricingField[];
  status: {
    enabled: boolean;
    kind: 'string' | 'boolean';
    label: string;
  };
}

interface PricingItem {
  id: number;
  module: string;
  module_label: string;
  name: string;
  subtitle?: string | null;
  category?: string | null;
  status?: string | number | boolean | null;
  updated_at?: string | null;
  values: Record<string, unknown>;
}

interface PricingResponse {
  success: boolean;
  message?: string;
  modules?: PricingModule[];
  active_module?: PricingModule | null;
  data?: PricingItem[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  summary?: {
    min: number;
    max: number;
    avg: number;
  };
}

const iconMap = {
  zap: Zap,
  bolt: Bolt,
  layers: Layers3,
  package: Package,
  gamepad: Gamepad2,
  headset: Headset,
  workflow: Workflow,
  'credit-card': CreditCard,
  megaphone: Megaphone,
  server: Server,
};

const toneClasses: Record<PricingModule['tone'], string> = {
  blue: 'from-blue-500/20 to-cyan-500/10 text-blue-500 border-blue-500/20',
  emerald: 'from-emerald-500/20 to-lime-500/10 text-emerald-500 border-emerald-500/20',
  amber: 'from-amber-500/20 to-orange-500/10 text-amber-500 border-amber-500/20',
  violet: 'from-violet-500/20 to-fuchsia-500/10 text-violet-500 border-violet-500/20',
  rose: 'from-rose-500/20 to-red-500/10 text-rose-500 border-rose-500/20',
  cyan: 'from-cyan-500/20 to-sky-500/10 text-cyan-500 border-cyan-500/20',
  slate: 'from-slate-500/15 to-slate-400/5 text-slate-500 border-slate-300 dark:border-white/10 dark:text-slate-300',
};

function rowKey(item: PricingItem) {
  return `${item.module}-${item.id}`;
}

function formatFieldValue(value: unknown, field?: PricingField) {
  const numberValue = toNumber(value, 0);
  if (field?.kind === 'money') return formatCurrency(numberValue);
  if (field?.kind === 'percent') return `${formatNumber(numberValue)}%`;
  return formatNumber(numberValue);
}

function getPrimaryField(module?: PricingModule | null) {
  return module?.fields.find((field) => field.primary) || module?.fields.find((field) => field.editable) || module?.fields[0];
}

function buildDraft(item: PricingItem, module?: PricingModule | null) {
  const draft: Record<string, string> = {};
  for (const field of module?.fields || []) {
    draft[field.key] = item.values[field.key] === null || item.values[field.key] === undefined
      ? ''
      : String(item.values[field.key]);
  }
  draft.__status = item.status === null || item.status === undefined ? '' : String(item.status);
  return draft;
}

export function AdminPricingPage() {
  const [modules, setModules] = useState<PricingModule[]>([]);
  const [activeModuleKey, setActiveModuleKey] = useState('');
  const [items, setItems] = useState<PricingItem[]>([]);
  const [summary, setSummary] = useState({ min: 0, max: 0, avg: 0 });
  const [pagination, setPagination] = useState<PricingResponse['pagination']>();
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingRow, setSavingRow] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPercent, setBulkPercent] = useState('10');
  const [bulkValue, setBulkValue] = useState('');
  const [targetFieldKey, setTargetFieldKey] = useState('');

  const activeModule = useMemo(
    () => modules.find((module) => module.key === activeModuleKey) || modules[0] || null,
    [activeModuleKey, modules]
  );
  const editableFields = useMemo(
    () => activeModule?.fields.filter((field) => field.editable) || [],
    [activeModule]
  );
  const primaryField = getPrimaryField(activeModule);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const totalServices = useMemo(() => modules.reduce((sum, module) => sum + module.count, 0), [modules]);

  async function loadPricing() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '50',
      });
      if (activeModuleKey) params.set('module', activeModuleKey);
      if (search.trim()) params.set('search', search.trim());

      const response = await fetch(`/api/admin/pricing?${params.toString()}`, { cache: 'no-store' });
      const payload: PricingResponse = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải bảng giá');
      }

      const nextModules = payload.modules || [];
      const nextActive = payload.active_module?.key || nextModules[0]?.key || '';
      const nextItems = payload.data || [];
      setModules(nextModules);
      setActiveModuleKey((current) => nextModules.some((module) => module.key === current) ? current : nextActive);
      setItems(nextItems);
      setPagination(payload.pagination);
      setSummary(payload.summary || { min: 0, max: 0, avg: 0 });
      setSelected([]);

      const moduleForDraft = payload.active_module || nextModules.find((module) => module.key === nextActive) || null;
      setDrafts(Object.fromEntries(nextItems.map((item) => [rowKey(item), buildDraft(item, moduleForDraft)])));

      if (!targetFieldKey && moduleForDraft) {
        setTargetFieldKey(getPrimaryField(moduleForDraft)?.key || '');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải bảng giá');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPricing();
  }, [activeModuleKey, search, page]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !bulkLoading && !savingRow && selected.length === 0) {
        void loadPricing();
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [activeModuleKey, search, page, bulkLoading, savingRow, selected.length]);

  useEffect(() => {
    const nextField = getPrimaryField(activeModule)?.key || '';
    setTargetFieldKey(nextField);
    setPage(1);
  }, [activeModuleKey]);

  function updateDraft(item: PricingItem, key: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [rowKey(item)]: {
        ...current[rowKey(item)],
        [key]: value,
      },
    }));
  }

  function toggleSelected(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    const visibleIds = items.map((item) => item.id);
    const allSelected = visibleIds.every((id) => selectedSet.has(id));
    setSelected(allSelected ? [] : visibleIds);
  }

  async function saveItem(item: PricingItem) {
    if (!activeModule) return;
    const key = rowKey(item);
    const draft = drafts[key] || {};
    setSavingRow(key);

    try {
      const fields = Object.fromEntries(editableFields.map((field) => [field.key, draft[field.key] ?? '']));
      const response = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: activeModule.key,
          id: item.id,
          fields,
          status: activeModule.status.enabled ? draft.__status : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu giá');
      }

      toast.success('Đã cập nhật giá dịch vụ');
      void loadPricing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu giá');
    } finally {
      setSavingRow('');
    }
  }

  async function runBulk(action: 'bulk-percent' | 'bulk-set') {
    if (!activeModule || !targetFieldKey) return;
    const hasSelected = selected.length > 0;
    const applyFiltered = !hasSelected;

    if (applyFiltered) {
      const ok = window.confirm('Bạn chưa chọn dòng nào. Áp dụng thao tác này cho toàn bộ module/dữ liệu đang lọc?');
      if (!ok) return;
    }

    setBulkLoading(true);
    try {
      const body =
        action === 'bulk-percent'
          ? {
              action,
              module: activeModule.key,
              targetField: targetFieldKey,
              percent: Number(bulkPercent),
              ids: selected,
              scope: hasSelected ? 'selected' : 'filtered',
              search,
              confirm: applyFiltered,
            }
          : {
              action,
              module: activeModule.key,
              targetField: targetFieldKey,
              fields: { [targetFieldKey]: bulkValue },
              ids: selected,
              scope: hasSelected ? 'selected' : 'filtered',
              search,
              confirm: applyFiltered,
            };

      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xử lý hàng loạt');
      }

      toast.success(`Đã cập nhật ${formatNumber(Number(payload.affected || 0))} dịch vụ`);
      void loadPricing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý hàng loạt');
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Pricing Center"
        title="Điều phối giá toàn bộ dịch vụ"
        description="Một màn hình để set giá SMM, Auto MXH, tài nguyên, game market, Support TikTok, thẻ cào và các service legacy. Tất cả đọc/ghi trực tiếp MySQL, không dùng mock."
        stats={[
          { label: 'Module giá', value: String(modules.length), hint: 'Bảng có schema hợp lệ', tone: 'blue' },
          { label: 'Dịch vụ', value: formatNumber(totalServices), hint: 'Tổng record có thể chỉnh', tone: 'emerald' },
          { label: 'Giá thấp', value: primaryField?.kind === 'percent' ? `${formatNumber(summary.min)}%` : formatCurrency(summary.min), hint: activeModule?.label || 'Module hiện tại', tone: 'amber' },
          { label: 'Giá cao', value: primaryField?.kind === 'percent' ? `${formatNumber(summary.max)}%` : formatCurrency(summary.max), hint: 'Theo field chính', tone: 'violet' },
        ]}
        actions={
          <>
            <Badge variant="info" className="rounded-full px-3 py-1.5">
              <BadgeDollarSign className="h-3 w-3" />
              DB pricing
            </Badge>
            <Badge variant="muted" className="rounded-full px-3 py-1.5">
              SMM override bằng custom_price
            </Badge>
          </>
        }
      />

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Modules"
          title="Chọn nhóm dịch vụ cần set giá"
          description="Những module không có bảng/cột giá trong MySQL sẽ tự ẩn, tránh lỗi schema khi deploy."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => void loadPricing()} loading={loading}>
              <RefreshCw className="h-4 w-4" />
              Tải lại
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => {
            const Icon = iconMap[module.icon as keyof typeof iconMap] || SlidersHorizontal;
            const active = module.key === activeModule?.key;

            return (
              <button
                key={module.key}
                type="button"
                onClick={() => {
                  setActiveModuleKey(module.key);
                  setSelected([]);
                }}
                className={cn(
                  'group relative overflow-hidden rounded-[1.45rem] border p-4 text-left transition-all duration-300 hover:-translate-y-1',
                  active
                    ? 'border-brand-blue/40 bg-brand-blue/10 shadow-[0_24px_70px_-42px_rgba(37,99,235,0.85)]'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20'
                )}
              >
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', toneClasses[module.tone])} />
                <div className="relative flex items-start justify-between gap-3">
                  <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-white/70 dark:bg-slate-950/40', toneClasses[module.tone])}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-slate-950 px-2.5 py-1 font-mono text-[10px] font-black text-white dark:bg-white dark:text-slate-950">
                    {formatNumber(module.count)}
                  </span>
                </div>
                <div className="relative mt-4">
                  <div className="text-sm font-black uppercase tracking-[-0.02em] text-slate-950 dark:text-white">
                    {module.label}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                    {module.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </SectionPanel>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow={activeModule?.label || 'Pricing'}
          title="Bảng chỉnh giá dịch vụ"
          description="Chỉnh từng dòng hoặc bulk theo phần trăm. Nếu không chọn dòng, thao tác bulk sẽ áp dụng cho toàn bộ kết quả đang lọc sau khi xác nhận."
        />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchDraft);
            }}
          >
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Tìm theo tên, category, service id, provider..."
              className="pl-11"
            />
          </form>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_auto]">
            <select
              value={targetFieldKey}
              onChange={(event) => setTargetFieldKey(event.target.value)}
              className="field-elevated h-11 rounded-[1rem] px-3 text-xs font-black uppercase tracking-wider outline-none dark:text-white"
            >
              {editableFields.map((field) => (
                <option key={field.key} value={field.key}>{field.label}</option>
              ))}
            </select>
            <Input
              value={bulkPercent}
              onChange={(event) => setBulkPercent(event.target.value)}
              type="number"
              step="0.01"
              placeholder="+10"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void runBulk('bulk-percent')} loading={bulkLoading}>
              <Sparkles className="h-4 w-4" />
              +/- %
            </Button>
          </div>
        </div>

        <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03] md:grid-cols-[1fr_auto_auto]">
          <Input
            value={bulkValue}
            onChange={(event) => setBulkValue(event.target.value)}
            type="number"
            step="0.0001"
            placeholder="Nhập giá cố định cho field đang chọn"
          />
          <Button type="button" variant="secondary" onClick={() => void runBulk('bulk-set')} loading={bulkLoading}>
            <SlidersHorizontal className="h-4 w-4" />
            Set giá
          </Button>
          <Button type="button" variant="ghost" onClick={toggleAllVisible}>
            <CheckCircle2 className="h-4 w-4" />
            {selected.length ? `${selected.length} đã chọn` : 'Chọn trang này'}
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="h-56 animate-pulse rounded-[1.6rem] bg-slate-100 dark:bg-white/[0.04]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Không có dịch vụ phù hợp"
            description="Thử đổi keyword hoặc chọn module khác. Dữ liệu vẫn đang đọc từ MySQL thật."
            icon={<Search className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {items.map((item) => {
              const key = rowKey(item);
              const draft = drafts[key] || buildDraft(item, activeModule);
              const isSelected = selectedSet.has(item.id);
              const mainValue = primaryField ? item.values[primaryField.key] : 0;

              return (
                <Card
                  key={key}
                  className={cn(
                    'group relative overflow-hidden rounded-[1.7rem] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-55px_rgba(37,99,235,0.8)]',
                    isSelected ? 'ring-2 ring-brand-blue/40' : ''
                  )}
                >
                  <div className="pointer-events-none absolute -right-14 -top-14 h-32 w-32 rounded-full bg-brand-blue/10 blur-3xl transition group-hover:bg-brand-blue/20" />
                  <div className="relative flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => toggleSelected(item.id)}
                      className={cn(
                        'mt-1 h-5 w-5 rounded-md border transition-all',
                        isSelected
                          ? 'border-brand-blue bg-brand-blue shadow-[0_0_0_4px_rgba(37,99,235,0.14)]'
                          : 'border-slate-300 bg-white dark:border-white/20 dark:bg-white/5'
                      )}
                      aria-label="Chọn dịch vụ"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted">#{item.id}</Badge>
                        {item.category ? <Badge variant="info">{String(item.category).slice(0, 32)}</Badge> : null}
                        {activeModule?.status.enabled ? (
                          <Badge variant={String(item.status) === 'active' || String(item.status) === '1' ? 'success' : 'warning'}>
                            {String(item.status ?? 'none')}
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-base font-black uppercase leading-[1.3] tracking-[-0.02em] text-slate-950 dark:text-white">
                        {String(item.name || `Service #${item.id}`)}
                      </h3>
                      {item.subtitle ? (
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                          {String(item.subtitle)}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                        {primaryField?.label || 'Giá'}
                      </div>
                      <div className="mt-1 font-mono text-lg font-black text-brand-blue">
                        {formatFieldValue(mainValue, primaryField)}
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-5 grid gap-3 md:grid-cols-2">
                    {activeModule?.fields.map((field) => (
                      <label key={field.key} className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          {field.label}
                        </span>
                        <Input
                          value={draft[field.key] ?? ''}
                          onChange={(event) => updateDraft(item, field.key, event.target.value)}
                          type="number"
                          step="0.0001"
                          disabled={!field.editable}
                          className={cn(!field.editable ? 'opacity-70' : '')}
                        />
                      </label>
                    ))}

                    {activeModule?.status.enabled ? (
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Trạng thái
                        </span>
                        <select
                          value={draft.__status ?? ''}
                          onChange={(event) => updateDraft(item, '__status', event.target.value)}
                          className="field-elevated h-11 w-full rounded-[1rem] px-3 text-sm font-black outline-none dark:text-white"
                        >
                          {activeModule.status.kind === 'boolean' ? (
                            <>
                              <option value="1">Đang bật</option>
                              <option value="0">Đang tắt</option>
                            </>
                          ) : (
                            <>
                              <option value="active">active</option>
                              <option value="inactive">inactive</option>
                              <option value="pending">pending</option>
                              <option value="disabled">disabled</option>
                            </>
                          )}
                        </select>
                      </label>
                    ) : null}
                  </div>

                  <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {item.updated_at ? formatDatabaseDateTime(item.updated_at) : 'Chưa có timestamp'}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveItem(item)}
                      loading={savingRow === key}
                    >
                      <Save className="h-4 w-4" />
                      Lưu
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {pagination ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-white/10 md:flex-row md:items-center md:justify-between">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Trang {pagination.page}/{pagination.total_pages} · {formatNumber(pagination.total)} dịch vụ
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Trước
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => setPage((current) => current + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        ) : null}
      </SectionPanel>
    </div>
  );
}
