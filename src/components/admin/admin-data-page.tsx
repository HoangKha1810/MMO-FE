'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Input } from '@/components/ui/input';
import { EmptyState, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const GLOBAL_ACTION_KEYS = new Set(['sync', 'check-new-deposits']);
const LONG_TEXT_FIELD_TOKENS = ['description', 'content', 'message', 'payload', 'note', 'reason', 'key'];
const SECTION_TITLE_LABELS: Record<string, string> = {
  'Services SMM': 'Dịch vụ SMM',
  'Orders SMM': 'Đơn SMM',
  'SMM orders': 'Đơn SMM',
  'SMM services': 'Dịch vụ SMM',
  'SMM providers': 'Provider SMM',
  'API providers': 'API Provider',
  'Auto MXH categories': 'Danh mục Auto MXH',
  'Auto MXH products': 'Sản phẩm Auto MXH',
  'Auto MXH orders': 'Đơn Auto MXH',
  'Auto MXH variants': 'Biến thể Auto MXH',
  'Support TikTok orders': 'Đơn Support TikTok',
  'Support TikTok menus': 'Menu Support TikTok',
  'Support TikTok region services': 'Dịch vụ theo khu vực',
  'Region services': 'Dịch vụ theo khu vực',
  'Message reports': 'Báo cáo tin nhắn',
  'MMO resources': 'Tài nguyên MMO',
  'MMO API providers': 'Provider MMO API',
  'Resource categories': 'Danh mục tài nguyên',
  'Resource sales': 'Đơn tài nguyên',
  'Resource orders': 'Đơn tài nguyên',
  'Forum categories': 'Danh mục forum',
  'Forum folders': 'Chuyên mục forum',
  Threads: 'Chủ đề',
  Posts: 'Bài trả lời',
  'Forum ads': 'Quảng cáo forum',
  'Forum reports': 'Báo cáo forum',
  'Forum badges': 'Huy hiệu forum',
  'Forum prefixes': 'Prefix forum',
  'Card rates': 'Tỷ lệ thẻ cào',
  'Card orders': 'Giao dịch thẻ cào',
  'Card history': 'Lịch sử thẻ cào',
  'Game market items': 'Sản phẩm Game Market',
  'Game market orders': 'Đơn Game Market',
  'Find Job posts': 'Bài đăng Find Job',
  'Find Job MMO': 'Bài đăng Find Job',
  'Forum badges & prefixes': 'Huy hiệu & prefix forum',
  'Forum approvals': 'Duyệt forum',
  'Forum hidden': 'Nội dung ẩn forum',
  'Forum members': 'Thành viên forum',
  'Forum settings': 'Cài đặt forum',
  'Accounting transactions': 'Giao dịch kế toán',
  'Accounting extra': 'Kế toán bổ sung',
  'Admin audit logs': 'Nhật ký admin',
  'Audit logs': 'Nhật ký admin',
  'Bank API logs': 'Log Bank API',
  'Card API config': 'Cấu hình API thẻ',
  'Interface settings': 'Cài đặt giao diện',
  Settings: 'Cài đặt',
  Providers: 'Provider API',
  'IP blacklist': 'Danh sách đen IP',
  'Banned IPs': 'IP đã chặn',
  'Activity logs': 'Nhật ký hoạt động',
  'Security logs': 'Nhật ký bảo mật',
  'Check IP': 'Kiểm tra IP',
};
const ACTION_TEXT_LABELS: Record<string, string> = {
  'Sync provider': 'Đồng bộ API',
  'Mark synced': 'Đánh dấu đã đồng bộ',
  'Check pending': 'Rà pending',
  Refund: 'Hoàn tiền',
  Refresh: 'Làm mới',
};
const ACTION_KEY_LABELS: Record<string, string> = {
  sync: 'Đồng bộ',
  'check-new-deposits': 'Rà pending',
  refund: 'Hoàn tiền',
  approve: 'Duyệt',
  reject: 'Từ chối',
  pin: 'Ghim',
  unpin: 'Bỏ ghim',
  'bulk-approve': 'Duyệt đã chọn',
  'bulk-reject': 'Từ chối đã chọn',
  'bulk-delete': 'Xóa đã chọn',
  'bulk-block-ip': 'Chặn IP đã chọn',
  'bulk-unblock-ip': 'Mở IP đã chọn',
  'lock-users-by-ip': 'Khóa user theo IP',
  'unlock-users-by-ip': 'Mở user theo IP',
  'block-ip': 'Chặn IP',
  'unblock-ip': 'Mở IP',
};
const COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  code: 'Mã',
  username: 'Username',
  email: 'Email',
  fullname: 'Họ tên',
  role: 'Vai trò',
  status: 'Trạng thái',
  balance: 'Số dư',
  rank: 'Hạng',
  amount: 'Số tiền',
  price: 'Giá bán',
  cost: 'Giá vốn',
  rate: 'Giá API',
  quantity: 'Số lượng',
  stock: 'Kho',
  title: 'Tiêu đề / Sản phẩm',
  description: 'Mô tả',
  content: 'Nội dung',
  message: 'Nội dung',
  name: 'Tên',
  slug: 'Slug',
  type: 'Loại',
  category: 'Danh mục',
  category_id: 'Mã danh mục',
  parent_id: 'Danh mục cha',
  product_code: 'Mã SP',
  resource_type: 'Loại tài nguyên',
  user_id: 'User ID',
  admin_id: 'Admin ID',
  target_user_id: 'User mục tiêu',
  provider_id: 'Provider ID',
  api_provider_id: 'API provider',
  api_service_id: 'API service',
  service_id: 'Service ID',
  api_order_id: 'Mã API order',
  service_name: 'Tên dịch vụ',
  service_key: 'Mã dịch vụ',
  tiktok_id: 'TikTok ID',
  buyer_name: 'Người mua',
  buyer_contact: 'Liên hệ mua',
  region: 'Khu vực',
  product_id: 'Sản phẩm ID',
  variant_id: 'Biến thể ID',
  resource_id: 'Tài nguyên ID',
  forum_id: 'Forum ID',
  thread_id: 'Thread ID',
  post_id: 'Post ID',
  item_id: 'Vật phẩm ID',
  seller_id: 'Người bán',
  buyer_id: 'Người mua',
  created_at: 'Tạo lúc',
  updated_at: 'Cập nhật lúc',
  posted_at: 'Đăng lúc',
  active_from: 'Bắt đầu',
  active_to: 'Kết thúc',
  expire_at: 'Hết hạn',
  expires_at: 'Hết hạn tải',
  last_sync: 'Sync gần nhất',
  last_seen: 'Thấy gần nhất',
  first_seen: 'Thấy lần đầu',
  last_ip: 'IP gần nhất',
  ip: 'IP',
  ip_address: 'Địa chỉ IP',
  user_agent: 'User agent',
  payment_method: 'Thanh toán',
  total_price: 'Tổng tiền',
  balance_after: 'Số dư sau',
  original_price: 'Giá gốc',
  custom_price: 'Giá tùy chỉnh',
  exchange_rate: 'Tỷ giá',
  min: 'Min',
  max: 'Max',
  total_orders: 'Tổng đơn',
  sold_count: 'Đã bán',
  views: 'Lượt xem',
  is_active: 'Kích hoạt',
  is_pinned: 'Ghim',
  is_deleted: 'Đã xóa',
  is_locked: 'Đã khóa',
  is_first_post: 'Bài mở đầu',
  is_exported: 'Đã xuất',
  auto_banned: 'Tự chặn',
  health_status: 'Tình trạng API',
  reason: 'Lý do',
  action: 'Hành động',
  activity: 'Hoạt động',
  event_type: 'Sự kiện',
  severity: 'Mức độ',
  payload: 'Payload',
  setting_key: 'Khóa cấu hình',
  setting_value: 'Giá trị cấu hình',
  account_name: 'Chủ tài khoản',
  account_number: 'Số tài khoản',
  telco: 'Nhà mạng',
  card_amount: 'Mệnh giá thẻ',
  serial: 'Serial',
  value: 'Mệnh giá',
  rate_exchange: 'Tỷ lệ đổi',
  rate_buy: 'Tỷ lệ mua',
  display_order: 'Thứ tự',
  sort_order: 'Thứ tự',
  duration_days: 'Số ngày',
  price_vnd: 'Giá VNĐ',
  show_limit: 'Giới hạn hiện',
  shown_count: 'Đã hiện',
  message_id: 'Tin nhắn ID',
  reported_user_id: 'User bị báo cáo',
  sample_users: 'User mẫu',
  accounts_count: 'Số tài khoản',
  active_count: 'User hoạt động',
  locked_count: 'User bị khóa',
  banned_state: 'Trạng thái ban',
  blacklisted_state: 'Blacklist',
  criteria_type: 'Loại tiêu chí',
  criteria_value: 'Giá trị tiêu chí',
  link_url: 'Link',
  budget_min: 'Ngân sách từ',
  budget_max: 'Ngân sách đến',
  price_min: 'Giá từ',
  price_max: 'Giá đến',
  posted_by: 'Người đăng',
  banned_by: 'Admin chặn',
  api_url: 'URL API',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Đang bật',
  inactive: 'Đang tắt',
  pending: 'Đang chờ',
  success: 'Thành công',
  failed: 'Thất bại',
  error: 'Lỗi',
  locked: 'Đã khóa',
  suspended: 'Tạm treo',
  banned: 'Đã ban',
  processing: 'Đang xử lý',
  completed: 'Hoàn thành',
  partial: 'Một phần',
  canceled: 'Đã hủy',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn',
  hidden: 'Ẩn',
  deleted: 'Đã xóa',
  rejected: 'Từ chối',
  reviewed: 'Đã xem',
  dismissed: 'Bỏ qua',
  clear: 'Bình thường',
  blacklisted: 'Blacklist',
  healthy: 'Ổn định',
  degraded: 'Cảnh báo',
  down: 'Mất kết nối',
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
  out_of_stock: 'Hết hàng',
};
const TOKEN_LABELS: Record<string, string> = {
  id: 'ID',
  ip: 'IP',
  api: 'API',
  url: 'URL',
  vnd: 'VND',
  mmo: 'MMO',
  smm: 'SMM',
  tiktok: 'TikTok',
};

function localizeAdminText(value: string) {
  return SECTION_TITLE_LABELS[value] || ACTION_TEXT_LABELS[value] || value;
}

function humanizeToken(token: string) {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return '';
  if (TOKEN_LABELS[normalized]) return TOKEN_LABELS[normalized];
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function humanizeFieldName(field: string) {
  if (COLUMN_LABELS[field]) return COLUMN_LABELS[field];
  return field
    .split('_')
    .map((part) => humanizeToken(part))
    .join(' ');
}

function resolveActionLabel(action: NonNullable<AdminSectionConfig['actions']>[number]) {
  return ACTION_TEXT_LABELS[action.label] || ACTION_KEY_LABELS[action.key] || action.label;
}

function humanizeStatusValue(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return STATUS_LABELS[raw.toLowerCase()] || raw;
}

function statusBadgeVariant(value: unknown): 'muted' | 'info' | 'warning' | 'success' | 'danger' {
  const normalized = String(value || '').trim().toLowerCase();
  if (['active', 'success', 'completed', 'approved', 'clear', 'healthy'].includes(normalized)) return 'success';
  if (['pending', 'processing', 'review', 'reviewed', 'degraded', 'partial'].includes(normalized)) return 'info';
  if (['high', 'critical', 'blacklisted', 'banned', 'locked', 'suspended', 'failed', 'error', 'deleted', 'rejected', 'canceled', 'cancelled', 'inactive', 'down'].includes(normalized)) return 'danger';
  if (['medium', 'warning', 'out_of_stock'].includes(normalized)) return 'warning';
  return 'muted';
}

function isStatusColumn(column: string) {
  return column === 'status' || column.endsWith('_status') || column.endsWith('_state') || ['health_status', 'severity'].includes(column);
}

function isCodeLikeColumn(column: string) {
  return column === 'id' || column.endsWith('_id') || ['product_code', 'api_order_id', 'service_key', 'account_number', 'serial', 'ip', 'ip_address', 'last_ip', 'slug'].includes(column);
}

function isLongTextField(field: string) {
  return LONG_TEXT_FIELD_TOKENS.some((token) => field.includes(token));
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

function formatCell(value: unknown, column?: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') {
    if (column?.startsWith('is_') || column?.startsWith('allow_')) {
      return value ? 'Bật' : 'Tắt';
    }
    return value ? 'Có' : 'Không';
  }
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string') {
    if (column && isStatusColumn(column)) {
      return humanizeStatusValue(value);
    }
    if (/^\d{4}-\d{2}-\d{2}(?:[ T])/.test(value)) {
      return formatDatabaseDateTime(value);
    }
    if ((column?.startsWith('is_') || column?.startsWith('allow_')) && ['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
      return ['1', 'true'].includes(value.toLowerCase()) ? 'Bật' : 'Tắt';
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

function rowId(row: Record<string, unknown>) {
  return Number(row.id || 0);
}

function mergeIncomingRows(
  previous: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>
) {
  const previousMap = new Map(previous.map((row) => [rowId(row), row] as const));

  return incoming.map((row) => {
    const id = rowId(row);
    if (!id) return row;

    const previousRow = previousMap.get(id);
    if (!previousRow) return row;

    return JSON.stringify(previousRow) === JSON.stringify(row) ? previousRow : { ...previousRow, ...row };
  });
}

function keepSelectedRows(selected: number[], nextRows: Array<Record<string, unknown>>) {
  const nextIds = new Set(nextRows.map((row) => rowId(row)).filter(Boolean));
  return selected.filter((id) => nextIds.has(id));
}

export function AdminDataPage({ title, description, sections }: AdminDataPageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSection = sections[activeIndex] || sections[0];
  const localizedTitle = localizeAdminText(title);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">
            {localizedTitle}
          </h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="muted" className="rounded-lg px-3 py-2 text-[10px] tracking-widest">
            {sections.length} nhóm dữ liệu
          </Badge>
          <Badge variant="info" className="rounded-lg px-3 py-2 text-[10px] tracking-widest">
            Dữ liệu admin live
          </Badge>
        </div>
      </div>

      {sections.length > 1 ? (
        <SectionPanel className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
            {sections.map((section, index) => (
              <button
                key={section.resource + section.title}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'whitespace-nowrap rounded-lg px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all',
                  index === activeIndex
                    ? 'border border-brand-blue/20 bg-brand-blue/10 text-brand-blue'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                )}
              >
                {localizeAdminText(section.title)}
              </button>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      <AdminTableSection key={`${activeSection.resource}-${activeSection.title}`} section={activeSection} />
    </div>
  );
}

function AdminTableSection({ section }: { section: AdminSectionConfig }) {
  const { confirm } = useConfirmDialog();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [pagination, setPagination] = useState<ApiResponse['pagination']>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [editor, setEditor] = useState<{
    mode: 'create' | 'edit';
    row?: Record<string, unknown>;
    values: Record<string, unknown>;
  } | null>(null);

  const editableFields = section.editableFields || [];
  const createFields = section.createFields || [];
  const canEdit = editableFields.length > 0;
  const canCreate = createFields.length > 0;
  const page = pagination?.page || 1;
  const totalPages = pagination?.total_pages || 1;
  const totalRows = pagination?.total || rows.length;
  const visibleFrom = rows.length === 0 ? 0 : (page - 1) * perPage + 1;
  const visibleTo = rows.length === 0 ? 0 : Math.min(totalRows, (page - 1) * perPage + rows.length);
  const paginationPages = useMemo(() => buildPaginationPages(page, totalPages), [page, totalPages]);
  const globalActions = section.actions?.filter((action) => GLOBAL_ACTION_KEYS.has(action.key)) || [];
  const rowActions = section.actions?.filter((action) => !GLOBAL_ACTION_KEYS.has(action.key) && !action.key.startsWith('bulk-')) || [];
  const bulkActions = section.actions?.filter((action) => action.key.startsWith('bulk-')) || [];

  async function loadData(
    page = 1,
    options?: {
      silent?: boolean;
      merge?: boolean;
      preserveSelection?: boolean;
      pageSize?: number;
    }
  ) {
    if (options?.silent) {
      setBackgroundRefreshing(true);
    } else {
      setLoading(true);
    }
    const effectivePageSize = options?.pageSize || perPage;
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(effectivePageSize),
    });
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);

    try {
      const response = await fetch(`/api/admin/${section.resource}?${params.toString()}`, { cache: 'no-store' });
      const payload: ApiResponse = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dữ liệu');
      }
      const nextRows = payload.data || [];
      setRows((current) => (options?.merge ? mergeIncomingRows(current, nextRows) : nextRows));
      setPagination(payload.pagination);
      if (payload.pagination?.per_page) {
        setPerPage(payload.pagination.per_page);
      }
      setSelected((current) => (options?.preserveSelection ? keepSelectedRows(current, nextRows) : []));
      setLastSyncedAt(new Date());
    } catch (error) {
      if (!options?.silent) {
        toast.error(error instanceof Error ? error.message : 'Không thể tải dữ liệu');
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
    void loadData(1);
  }, [section.resource, status, perPage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!editor && document.visibilityState === 'visible') {
        void loadData(pagination?.page || 1, { silent: true, merge: true, preserveSelection: true, pageSize: perPage });
      }
    }, 20000);

    return () => window.clearInterval(timer);
  }, [section.resource, status, search, editor, pagination?.page, perPage]);

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
    if (!id) return;

    const confirmed = await confirm({
      title: 'Xóa hoặc ẩn dữ liệu',
      description: `Xác nhận xóa hoặc ẩn bản ghi #${id}? Bạn vẫn có thể cần reload lại dữ liệu sau thao tác này.`,
      confirmText: 'Xóa dữ liệu',
      cancelText: 'Giữ lại',
      tone: 'danger',
    });

    if (!confirmed) return;
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
      <SectionPanel className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <SectionHeader
          eyebrow="Dataset"
          title={localizeAdminText(section.title)}
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
                  Thêm mới
                </Button>
              ) : null}
              {globalActions.map((action) => (
                <Button
                  key={action.key}
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={saving}
                  onClick={() => runAction(action.key)}
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', saving && 'animate-spin')} />
                  {resolveActionLabel(action)}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => loadData(pagination?.page || 1, { preserveSelection: true })}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </>
          }
        />

        <form
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_220px_auto]"
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
          <select
            value={String(perPage)}
            onChange={(event) => {
              const nextPerPage = Number(event.target.value || 25);
              setSelected([]);
              setPerPage(nextPerPage);
            }}
            className="field-elevated h-11 rounded-[1rem] px-4 text-sm font-bold text-slate-700 outline-none dark:text-white"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Hiển thị {option} dòng
              </option>
            ))}
          </select>
          {section.statusOptions?.length ? (
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="field-elevated h-11 rounded-[1rem] px-4 text-sm font-bold text-slate-700 outline-none dark:text-white"
            >
              <option value="">Tất cả trạng thái</option>
              {section.statusOptions.map((option) => (
                <option key={option} value={option}>{humanizeStatusValue(option)}</option>
              ))}
            </select>
          ) : null}
          <Button type="submit" size="default" className="w-full lg:w-auto">
            <Search className="mr-2 h-4 w-4" />
            Lọc dữ liệu
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Badge variant="muted" className="rounded-lg px-3 py-1.5">
            Tổng {totalRows} dòng
          </Badge>
          <Badge variant="muted" className="rounded-lg px-3 py-1.5">
            Trang {page}/{totalPages}
          </Badge>
          <Badge variant={selected.length > 0 ? 'info' : 'muted'} className="rounded-lg px-3 py-1.5">
            Đã chọn {selected.length} dòng
          </Badge>
          <Badge variant={backgroundRefreshing ? 'info' : 'muted'} className="rounded-lg px-3 py-1.5">
            {backgroundRefreshing
              ? 'Đang đồng bộ nền...'
              : lastSyncedAt
                ? `Cập nhật ${lastSyncedAt.toLocaleTimeString('vi-VN', { hour12: false })}`
                : 'Chưa đồng bộ'}
          </Badge>
        </div>

        {selected.length > 0 ? (
          <div className="rounded-xl border border-brand-blue/15 bg-brand-blue/10 p-4 dark:border-brand-blue/20 dark:bg-brand-blue/10">
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
                    <option value="">Đổi trạng thái</option>
                    {section.statusOptions.map((option) => (
                      <option key={option} value={option}>{humanizeStatusValue(option)}</option>
                    ))}
                  </select>
                ) : null}
                {bulkActions.map((action) => (
                  <Button
                    key={action.key}
                    type="button"
                    size="sm"
                    variant={action.tone === 'danger' ? 'destructive' : 'default'}
                    onClick={() => runAction(action.key)}
                  >
                    {resolveActionLabel(action)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.length === rows.length}
                      onChange={(event) => setSelected(event.target.checked ? rows.map((row) => Number(row.id)).filter(Boolean) : [])}
                    />
                  </th>
                  {section.columns.map((column) => (
                    <th key={column} className="px-4 py-3">{humanizeFieldName(column)}</th>
                  ))}
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                {loading && rows.length === 0 ? (
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
                        <td
                          key={column}
                          className={cn(
                            'max-w-[260px] px-4 py-3 font-medium leading-7 text-slate-600 dark:text-slate-300',
                            isCodeLikeColumn(column) && 'font-mono text-[13px] tracking-tight text-slate-500 dark:text-slate-200'
                          )}
                        >
                          {column === 'is_pinned' ? (
                            <Badge variant={pinned ? 'warning' : 'muted'} className="w-fit rounded-full px-3 py-1.5">
                              {pinned ? 'Đang ghim' : 'Không'}
                            </Badge>
                          ) : isStatusColumn(column) ? (
                            <Badge variant={statusBadgeVariant(row[column])} className="w-fit rounded-full px-3 py-1.5">
                              {formatCell(row[column], column)}
                            </Badge>
                          ) : formatCell(row[column], column)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {rowActions.map((action) => (
                            <Button
                              key={action.key}
                              type="button"
                              size="sm"
                              variant={action.tone === 'danger' ? 'destructive' : action.tone === 'success' ? 'secondary' : 'outline'}
                              disabled={saving}
                              onClick={() => runAction(action.key, id)}
                            >
                              {resolveActionLabel(action)}
                            </Button>
                          ))}
                          {canEdit ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditor({ mode: 'edit', row, values: initialValues(editableFields, row) })}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
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
          <span>
            Hiển thị {visibleFrom}-{visibleTo} / {totalRows} dòng
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pagination || page <= 1}
              onClick={() => loadData(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Trước
            </Button>
            {paginationPages.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="flex h-9 items-center px-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={item === page ? 'default' : 'outline'}
                  onClick={() => loadData(item)}
                >
                  {item}
                </Button>
              )
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pagination || page >= totalPages}
              onClick={() => loadData(page + 1)}
            >
              Sau
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </SectionPanel>

      {editor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[12px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1a1a1a]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black uppercase tracking-[-0.04em] text-slate-900 dark:text-white">
                  {editor.mode === 'create' ? 'Thêm mới' : `Sửa #${editor.row?.id}`}
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{localizeAdminText(section.title)}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditor(null)}>
                Đóng
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {Object.keys(editor.values).map((field) => (
                <label key={field} className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">
                    {humanizeFieldName(field)}
                  </span>
                  {field === 'status' && section.statusOptions?.length ? (
                    <select
                      value={String(editor.values[field] ?? '')}
                      onChange={(event) => setEditor((current) => current ? {
                        ...current,
                        values: { ...current.values, [field]: event.target.value },
                      } : current)}
                      className="w-full rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none transition-all dark:border-white/10 dark:bg-[#111] dark:text-white"
                    >
                      {section.statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {humanizeStatusValue(option)}
                        </option>
                      ))}
                    </select>
                  ) : isLongTextField(field) ? (
                    <textarea
                      value={String(editor.values[field] ?? '')}
                      onChange={(event) => setEditor((current) => current ? {
                        ...current,
                        values: { ...current.values, [field]: event.target.value },
                      } : current)}
                      rows={4}
                      className="w-full rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none transition-all dark:border-white/10 dark:bg-[#111] dark:text-white"
                    />
                  ) : (
                    <Input
                      value={String(editor.values[field] ?? '')}
                      onChange={(event) => setEditor((current) => current ? {
                        ...current,
                        values: { ...current.values, [field]: event.target.value },
                      } : current)}
                    />
                  )}
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
