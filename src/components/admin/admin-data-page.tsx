'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, RefreshCw, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import type { AdminSectionConfig } from '@/lib/admin-page-config';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { cn, formatNumber } from '@/lib/utils';

interface AdminDataPageProps {
  title: string;
  description: string;
  sections: AdminSectionConfig[];
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: Array<Record<string, unknown>>;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  readonly?: boolean;
  create_fields?: string[];
  update_fields?: string[];
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}(?:[ T])/.test(value)) {
      return formatDatabaseDateTime(value);
    }
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return String(object.username || object.title || object.name || JSON.stringify(object));
  }
  return String(value);
}

function initialValues(fields: string[], row?: Record<string, unknown>) {
  return Object.fromEntries(fields.map((field) => [field, row?.[field] ?? '']));
}

function isTruthy(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function AdminDataPage({ title, description, sections }: AdminDataPageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSection = sections[activeIndex] || sections[0];

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Control Room"
        title={title}
        description={description}
        stats={[
          { label: 'Section', value: String(sections.length), hint: 'Nhóm dữ liệu đang quản lý', tone: 'blue' },
          { label: 'Flow', value: 'CRUD', hint: 'Giữ nguyên API và logic xử lý', tone: 'emerald' },
          { label: 'Tác vụ', value: 'Search / Bulk', hint: 'Toolbar đồng bộ lại để thao tác nhanh hơn', tone: 'amber' },
          { label: 'UI', value: 'Refined', hint: 'Bố cục làm lại nhưng không đổi data flow', tone: 'violet' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted" className="rounded-full px-3 py-1.5">
              <Sparkles className="h-3 w-3" />
              Admin surface
            </Badge>
            <Badge variant="info" className="rounded-full px-3 py-1.5">
              Reused across pages
            </Badge>
          </div>
        }
      />

      {sections.length > 1 ? (
        <SectionPanel className="p-2">
          {sections.map((section, index) => (
            <button
              key={section.resource + section.title}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'whitespace-nowrap rounded-[1rem] px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] transition-all',
                index === activeIndex
                  ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
              )}
            >
              {section.title}
            </button>
          ))}
        </SectionPanel>
      ) : null}

      <AdminTableSection key={`${activeSection.resource}-${activeSection.title}`} section={activeSection} />
    </div>
  );
}

function AdminTableSection({ section }: { section: AdminSectionConfig }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [pagination, setPagination] = useState<ApiResponse['pagination']>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [editor, setEditor] = useState<{
    mode: 'create' | 'edit';
    row?: Record<string, unknown>;
    values: Record<string, unknown>;
  } | null>(null);

  const editableFields = section.editableFields || [];
  const createFields = section.createFields || [];
  const canEdit = editableFields.length > 0;
  const canCreate = createFields.length > 0;

  async function loadData(page = 1) {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      per_page: '25',
    });
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);

    try {
      const response = await fetch(`/api/admin/${section.resource}?${params.toString()}`, { cache: 'no-store' });
      const payload: ApiResponse = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dữ liệu');
      }
      setRows(payload.data || []);
      setPagination(payload.pagination);
      setSelected([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(1);
  }, [section.resource, status]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!editor && document.visibilityState === 'visible') {
        void loadData(pagination?.page || 1);
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [section.resource, status, search, editor, pagination?.page]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleSelected(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saveEditor() {
    if (!editor) return;
    setSaving(true);
    try {
      const id = Number(editor.row?.id || 0);
      const response = await fetch(
        editor.mode === 'create' ? `/api/admin/${section.resource}` : `/api/admin/${section.resource}/${id}`,
        {
          method: editor.mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editor.values),
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu dữ liệu');
      }
      toast.success('Đã lưu dữ liệu');
      setEditor(null);
      await loadData(pagination?.page || 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu dữ liệu');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: Record<string, unknown>) {
    const id = Number(row.id || 0);
    if (!id || !window.confirm(`Xác nhận xóa/ẩn #${id}?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/${section.resource}/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xóa dữ liệu');
      }
      toast.success('Đã xử lý');
      await loadData(pagination?.page || 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xóa dữ liệu');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: string, id?: number) {
    const isBulk = action.startsWith('bulk-');
    const actionIds = id ? [id] : selected;
    if (isBulk && actionIds.length === 0) {
      toast.error('Chọn ít nhất một dòng');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/${section.resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, ids: actionIds }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Action thất bại');
      }
      toast.success('Đã chạy action');
      await loadData(pagination?.page || 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function bulkUpdateStatus(nextStatus: string) {
    if (!nextStatus || selected.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/${section.resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-update', ids: selected, patch: { status: nextStatus } }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể bulk update');
      }
      toast.success(`Đã cập nhật ${selected.length} dòng`);
      await loadData(pagination?.page || 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể bulk update');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Dataset"
          title={section.title}
          description={section.description}
          actions={
            <>
              {canCreate ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setEditor({ mode: 'create', values: initialValues(createFields) })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo mới
                </Button>
              ) : null}
              {section.actions?.filter((action) => ['sync', 'check-new-deposits'].includes(action.key)).map((action) => (
                <Button
                  key={action.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => runAction(action.key)}
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', saving && 'animate-spin')} />
                  {action.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => loadData(pagination?.page || 1)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </>
          }
        />

        <form
          className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void loadData(1);
          }}
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm kiếm theo nội dung, tiêu đề, người dùng..."
              className="pl-11"
            />
          </div>
          {section.statusOptions?.length ? (
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="field-elevated h-11 rounded-[1rem] px-4 text-sm font-bold text-slate-700 outline-none dark:text-white"
            >
              <option value="">Tất cả trạng thái</option>
              {section.statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : null}
          <Button type="submit" size="default">
            <Search className="mr-2 h-4 w-4" />
            Lọc dữ liệu
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Badge variant="muted" className="rounded-full px-3 py-1.5">
            Tổng {pagination?.total || rows.length} dòng
          </Badge>
          <Badge variant="muted" className="rounded-full px-3 py-1.5">
            Trang {pagination?.page || 1}/{pagination?.total_pages || 1}
          </Badge>
          <Badge variant={selected.length > 0 ? 'info' : 'muted'} className="rounded-full px-3 py-1.5">
            Đã chọn {selected.length}
          </Badge>
        </div>

        {selected.length > 0 ? (
          <div className="rounded-[1.45rem] border border-brand-blue/15 bg-brand-blue/10 p-4 dark:border-brand-blue/20 dark:bg-brand-blue/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm font-bold text-slate-700 dark:text-slate-100">
                Đã chọn {selected.length} dòng. Bạn có thể cập nhật trạng thái hàng loạt hoặc chạy action bulk bên dưới.
              </div>
              <div className="flex flex-wrap gap-2">
                {section.statusOptions?.length ? (
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      void bulkUpdateStatus(event.target.value);
                      event.currentTarget.value = '';
                    }}
                    className="field-elevated h-9 rounded-[0.95rem] px-3 text-xs font-bold text-slate-700 outline-none dark:text-white"
                  >
                    <option value="">Bulk status</option>
                    {section.statusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : null}
                {section.actions?.filter((action) => action.key.startsWith('bulk-')).map((action) => (
                  <Button
                    key={action.key}
                    type="button"
                    size="sm"
                    variant={action.tone === 'danger' ? 'destructive' : 'default'}
                    onClick={() => runAction(action.key)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[1.7rem] border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.length === rows.length}
                      onChange={(event) => setSelected(event.target.checked ? rows.map((row) => Number(row.id)).filter(Boolean) : [])}
                    />
                  </th>
                  {section.columns.map((column) => (
                    <th key={column} className="px-4 py-3">{column}</th>
                  ))}
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={section.columns.length + 2} className="px-4 py-16 text-center text-slate-400">
                      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={section.columns.length + 2} className="p-0">
                      <EmptyState
                        title="Không có dữ liệu"
                        description="Bộ lọc hiện tại chưa trả về bản ghi nào. Bạn có thể đổi keyword, trạng thái hoặc kiểm tra dữ liệu nguồn."
                        className="rounded-none border-0 shadow-none"
                      />
                    </td>
                  </tr>
                ) : rows.map((row) => {
                  const id = Number(row.id || 0);
                  const pinned = isTruthy(row.is_pinned);
                  return (
                    <tr
                      key={id || JSON.stringify(row)}
                      className={cn(
                        'align-top transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]',
                        pinned && 'bg-amber-50/50 dark:bg-amber-400/[0.04]'
                      )}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedSet.has(id)} onChange={() => toggleSelected(id)} />
                      </td>
                      {section.columns.map((column) => (
                        <td key={column} className="max-w-[260px] px-4 py-3 font-medium leading-7 text-slate-600 dark:text-slate-300">
                          {column === 'is_pinned' ? (
                            <Badge variant={pinned ? 'warning' : 'muted'} className="w-fit rounded-full px-3 py-1.5">
                              {pinned ? 'Đang ghim' : 'Không'}
                            </Badge>
                          ) : column === 'status' ? (
                            <Badge variant="muted" className="w-fit rounded-full px-3 py-1.5">
                              {formatCell(row[column])}
                            </Badge>
                          ) : formatCell(row[column])}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {section.actions?.filter((action) => !action.key.startsWith('bulk-')).map((action) => (
                            <Button
                              key={action.key}
                              type="button"
                              size="sm"
                              variant={action.tone === 'danger' ? 'destructive' : action.tone === 'success' ? 'secondary' : 'outline'}
                              disabled={saving}
                              onClick={() => runAction(action.key, id)}
                            >
                              {action.label}
                            </Button>
                          ))}
                          {canEdit ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditor({ mode: 'edit', row, values: initialValues(editableFields, row) })}
                            >
                              Sửa
                            </Button>
                          ) : null}
                          {canEdit ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={saving}
                              onClick={() => deleteRow(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-xs font-bold text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>Tổng {pagination?.total || rows.length} dòng</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pagination || pagination.page <= 1}
              onClick={() => loadData((pagination?.page || 1) - 1)}
            >
              Trước
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pagination || pagination.page >= pagination.total_pages}
              onClick={() => loadData((pagination?.page || 1) + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      </SectionPanel>

      {editor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="surface-panel-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black uppercase tracking-[-0.04em] text-slate-900 dark:text-white">
                  {editor.mode === 'create' ? 'Tạo mới' : `Sửa #${editor.row?.id}`}
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{section.title}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditor(null)}>
                Đóng
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {Object.keys(editor.values).map((field) => (
                <label key={field} className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">{field}</span>
                  <textarea
                    value={String(editor.values[field] ?? '')}
                    onChange={(event) => setEditor((current) => current ? {
                      ...current,
                      values: { ...current.values, [field]: event.target.value },
                    } : current)}
                    rows={field.includes('description') || field.includes('content') || field.includes('key') ? 4 : 1}
                    className="field-elevated w-full rounded-[1rem] px-3 py-2 text-sm font-bold outline-none dark:text-white"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                Hủy
              </Button>
              <Button
                type="button"
                disabled={saving}
                loading={saving}
                loadingText="Đang lưu..."
                onClick={saveEditor}
              >
                {!saving ? <Save className="mr-2 h-4 w-4" /> : null}
                Lưu
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
