'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Trash2,
  Underline,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Input } from '@/components/ui/input';
import { EmptyState, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import type { AdminSectionConfig } from '@/lib/admin-page-config';
import { formatDatabaseDateTime, formatDatabaseTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { normalizeSmmOrderStatus } from '@/lib/smm-status';
import { cn, formatCurrency, formatNumber, toNumber } from '@/lib/utils';

interface AdminDataPageProps {
  title: string;
  description: string;
  sections: AdminSectionConfig[];
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
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

interface DetailResponse {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

type SmmMarginScope = 'single' | 'selected' | 'filtered' | 'provider' | 'all';

interface SmmMarginDialogState {
  scope: SmmMarginScope;
  percent: string;
  row?: Record<string, unknown>;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const GLOBAL_ACTION_KEYS = new Set(['sync', 'check-new-deposits']);
const LONG_TEXT_FIELD_TOKENS = ['description', 'content', 'message', 'payload', 'note', 'reason', 'key'];
const LEGACY_COMMUNITY_LINKS = [
  { label: 'Nhóm Zalo', href: 'https://zalo.me/g/ibexon608' },
  { label: 'Nhóm Telegram', href: 'https://t.me/+XdGxk8YFEE2NmE1' },
  { label: 'Kênh Tiktok', href: 'http://www.tiktok.com/@haokimedia' },
] as const;
const LEGACY_ORDER_STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Đang chờ' },
  { value: 'processing', label: 'Đang chạy' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'canceled', label: 'Đã hủy' },
] as const;
const LEGACY_EDITOR_TOOLBAR = [Bold, Italic, Underline, List, ListOrdered, Link2, ImageIcon] as const;
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
  game_balance: 'Ví game',
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
  product_count: 'Số product',
  variant_count: 'Số variant',
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
  wallet_type: 'Ví',
  original_price: 'Giá gốc',
  custom_price: 'Giá tùy chỉnh',
  name_color: 'Màu chữ tên gói',
  exchange_rate: 'Tỷ giá',
  min: 'Min',
  max: 'Max',
  total_orders: 'Tổng đơn',
  sold_count: 'Đã bán',
  views: 'Lượt xem',
  is_active: 'Kích hoạt',
  is_pinned: 'Ghim',
  is_deleted: 'Đã xóa',
  fa_enabled: '2FA Google',
  telegram_2fa_enabled: '2FA Telegram',
  fa_type: 'Loại 2FA',
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
  'in progress': 'Đang chạy',
  running: 'Đang chạy',
  open: 'Đã duyệt',
  approved: 'Đã duyệt',
  selling: 'Đã duyệt',
  completed: 'Hoàn thành',
  done: 'Đã hoàn',
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

function humanizeResourceStatusValue(resource: string, value: unknown) {
  if (resource === 'smm-orders') {
    return humanizeStatusValue(normalizeSmmOrderStatus(value));
  }

  return humanizeStatusValue(value);
}

function statusBadgeVariant(value: unknown): 'muted' | 'info' | 'warning' | 'success' | 'danger' {
  const normalized = String(value || '').trim().toLowerCase();
  if (['active', 'success', 'completed', 'approved', 'clear', 'healthy', 'open', 'selling', 'done'].includes(normalized)) return 'success';
  if (['pending', 'processing', 'review', 'reviewed', 'degraded', 'partial', 'running', 'in progress'].includes(normalized)) return 'info';
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
    if (column === 'wallet_type') {
      return value.toLowerCase() === 'game' ? 'Ví game' : 'Ví chính';
    }
    if (column && isStatusColumn(column)) {
      return humanizeStatusValue(value);
    }
    if (/^\d{4}-\d{2}-\d{2}(?:[ T])/.test(value)) {
      return formatDatabaseDateTime(value);
    }
    if ((column?.startsWith('is_') || column?.startsWith('allow_')) && ['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
      return ['1', 'true'].includes(value.toLowerCase()) ? 'Bật' : 'Tắt';
    }
    if (column && isLongTextField(column)) {
      const sepayCode = extractPaymentDisplayCode(value);
      return sepayCode || value;
    }
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return String(object.username || object.title || object.name || JSON.stringify(object));
  }
  return String(value);
}

function resolveDisplayValue(row: Record<string, unknown>, column: string) {
  if (column === 'user_id') {
    const username = String(row.username || row.display_name || '').trim();
    if (username) return username;
  }

  if (column === 'category_id') {
    const categoryPath = String(row.category_path || row.category_name || '').trim();
    if (categoryPath) return categoryPath;
  }

  if (column === 'parent_id') {
    const parentName = String(row.parent_name || '').trim();
    if (parentName) return parentName;
  }

  return row[column];
}

function extractPaymentDisplayCode(value: string) {
  const matches = value.match(/\b(?:PAY[0-9A-Z]+|GAMESEP\d+T\d+|SEP\d+T\d+)\b/gi) || [];
  return matches.find((code) => /^PAY/i.test(code)) || '';
}

function initialValues(fields: string[], row?: Record<string, unknown>) {
  return Object.fromEntries(fields.map((field) => [field, row?.[field] ?? '']));
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function normalizeHexColor(value: unknown) {
  const raw = String(value || '').trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : '';
}

function hydrateEditorValues(resource: string, fields: string[], row?: Record<string, unknown>) {
  const values = initialValues(fields, row);
  if (resource === 'smm-services' && fields.includes('name_color')) {
    values.name_color = normalizeHexColor(parseJsonObject(row?.server_info).name_color);
  }
  return values;
}

function isTruthy(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function rowId(row: Record<string, unknown>) {
  return Number(row.id || 0);
}

function shouldHideEditorField(resource: string, field: string) {
  if (resource === 'users') {
    return field === 'id' || field === 'username' || field === 'created_at' || field === 'updated_at' || field === 'last_ip' || field === 'last_login';
  }
  return false;
}

function buildDirtyValues(
  resource: string,
  baseline: Record<string, unknown> | undefined,
  values: Record<string, unknown>
) {
  if (!baseline) return values;

  const nextEntries = Object.entries(values).filter(([field, value]) => {
    if (shouldHideEditorField(resource, field)) return false;
    const previous = baseline[field];
    return String(previous ?? '') !== String(value ?? '');
  });

  return Object.fromEntries(nextEntries);
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

function isLegacySmmServicesResource(resource: string) {
  return resource === 'smm-services';
}

function isLegacyAutoMxhOrdersResource(resource: string) {
  return resource === 'automxh-orders';
}

function isSmmServiceActive(row: Record<string, unknown>) {
  return String(row.status || 'active').trim().toLowerCase() === 'active' && !isTruthy(row.is_deleted);
}

function sortAutomxhEditorEntries(entries: Array<[string, unknown]>) {
  const preferredOrder = [
    'status',
    'price',
    'cost_price',
    'buyer_info',
    'api_order_id',
    'api_response',
    'api_status_log',
    'perfection_content',
    'perfection_image',
    'avatar_path',
    'additional_files',
    'confirm_1',
    'confirm_2',
    'is_exported',
  ];

  return [...entries].sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a[0]);
    const bIndex = preferredOrder.indexOf(b[0]);
    const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return normalizedA - normalizedB;
  });
}

function formatCompactTimestamp(value: unknown) {
  if (!value) return '—';
  const serialized = serializeDatabaseDateTime(value);
  const match = serialized.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return '—';

  const [, year, month, day, hour, minute] = match;
  return `${hour}:${minute} ${day}/${month}/${year}`;
}

function formatCompactClock(value: Date | null) {
  if (!value) return 'Chưa đồng bộ';
  return formatDatabaseTime(value);
}

function formatPriceValue(value: unknown) {
  return formatCurrency(toNumber(value, 0));
}

function normalizePublicAssetPath(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^data:/i.test(raw) || /^blob:/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('public/')) return `/${raw.slice('public/'.length)}`;
  if (raw.startsWith('assets/') || raw.startsWith('uploads/') || raw.startsWith('automxh/')) return `/${raw}`;
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  const raw = String(value || '').trim();
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch {
    // Fallback below keeps non-JSON legacy strings visible.
  }

  return [raw];
}

function parseAssetEntries(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return {
            url: normalizePublicAssetPath(record.url || record.path || ''),
            name: String(record.name || record.filename || '').trim(),
          };
        }
        return {
          url: normalizePublicAssetPath(item),
          name: '',
        };
      })
      .filter((item) => item.url);
  }

  const raw = String(value || '').trim();
  if (!raw) return [] as Array<{ url: string; name: string }>;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parseAssetEntries(parsed);
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const url = normalizePublicAssetPath(record.url || record.path || '');
      return url ? [{ url, name: String(record.name || record.filename || '').trim() }] : [];
    }
  } catch {
    // Ignore and fallback below.
  }

  const url = normalizePublicAssetPath(raw);
  return url ? [{ url, name: '' }] : [];
}

function parseCustomInputs(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return [] as Array<{ label: string; placeholder?: string }>;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        label: String(item?.label || '').trim(),
        placeholder: String(item?.placeholder || '').trim(),
      }))
      .filter((item) => item.label);
  } catch {
    return [];
  }
}

function parseCustomValueEntries(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | unknown[];
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }

    return Object.entries(parsed || {})
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([, item]) => String(item || '').trim())
      .filter(Boolean);
  } catch {
    return [raw];
  }
}

function detailEntries(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function renderTimelineValue(value: Record<string, unknown>) {
  if (value.activity) return String(value.activity);
  if (value.content) return String(value.content);
  if (value.description) return String(value.description);
  if (value.message) return String(value.message);
  if (value.service_name) return String(value.service_name);
  if (value.title) return String(value.title);
  return `#${value.id || ''}`;
}

function extractOrderInputRows(row: Record<string, unknown>) {
  const definitions = parseCustomInputs(row.custom_inputs);
  const values = parseCustomValueEntries(row.custom_value_display);
  const fallbackValues = [String(row.link || '').trim(), String(row.buyer_info_display || '').trim()].filter(Boolean);

  if (definitions.length > 0) {
    return definitions
      .map((definition, index) => ({
        label: definition.label,
        value: values[index] || fallbackValues[index] || '',
      }))
      .filter((item) => item.value);
  }

  return [
    { label: String(row.input_label || 'Liên kết / ID').trim(), value: fallbackValues[0] || '' },
    { label: String(row.buyer_label || 'Thông tin liên hệ').trim(), value: fallbackValues[1] || '' },
  ].filter((item) => item.value);
}

function formatOrderClipboardText(row: Record<string, unknown>) {
  const header = [`#${row.id}`, String(row.product_name || row.title || `Đơn ${row.id}`)].filter(Boolean).join(' - ');
  const inputs = extractOrderInputRows(row)
    .map((item) => `${item.label}: ${item.value}`)
    .join('\n');
  const extras = [
    `User: ${String(row.display_name || row.username || `#${row.user_id}`)}`,
    `Trạng thái: ${humanizeStatusValue(row.status)}`,
    `Giá: ${formatPriceValue(row.price)}`,
  ];

  return [header, inputs, extras.join('\n')].filter(Boolean).join('\n');
}

function formatOrderExportText(rows: Array<Record<string, unknown>>) {
  return rows
    .map((row) => formatOrderClipboardText(row))
    .join('\n\n------------------------------\n\n');
}

function getLegacyOrderStatusClasses(status: unknown) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed') {
    return 'border-emerald-400/30 bg-emerald-500/14 text-emerald-200';
  }
  if (normalized === 'canceled') {
    return 'border-rose-400/30 bg-rose-500/14 text-rose-200';
  }
  if (normalized === 'processing') {
    return 'border-cyan-400/30 bg-cyan-500/14 text-cyan-100';
  }
  return 'border-blue-400/30 bg-blue-500/16 text-blue-100';
}

function getSmmCategoryAccent(value: unknown) {
  const category = String(value || '').toUpperCase();
  if (category.startsWith('[FB]')) return 'text-sky-200';
  if (category.startsWith('[TT]')) return 'text-fuchsia-200';
  if (category.startsWith('[IG]')) return 'text-amber-200';
  if (category.startsWith('[YT]')) return 'text-red-200';
  return 'text-slate-200';
}

function getQuickStatusOptions(resource: string) {
  if (resource === 'find-jobs') {
    return [
      { value: '', label: 'Tất cả' },
      { value: 'pending', label: 'Đang chờ' },
      { value: 'open', label: 'Đã duyệt' },
      { value: 'rejected', label: 'Từ chối' },
    ];
  }

  if (resource === 'forum-threads' || resource === 'forum-posts') {
    return [
      { value: '', label: 'Tất cả' },
      { value: 'pending', label: 'Đang chờ' },
      { value: 'active', label: 'Đã duyệt' },
      { value: 'rejected', label: 'Từ chối' },
    ];
  }

  if (resource === 'game-items') {
    return [
      { value: '', label: 'Tất cả' },
      { value: 'pending', label: 'Đang chờ' },
      { value: 'selling', label: 'Đã duyệt' },
      { value: 'rejected', label: 'Từ chối' },
    ];
  }

  if (resource === 'smm-orders') {
    return [
      { value: '', label: 'Tất cả' },
      { value: 'Processing', label: 'Đang chạy' },
      { value: 'Completed', label: 'Hoàn Thành' },
      { value: 'Refunded', label: 'Đã Hoàn' },
      { value: 'Canceled', label: 'Đã Hủy' },
    ];
  }

  return [];
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
  const isLegacySmmServices = isLegacySmmServicesResource(section.resource);
  const isLegacyAutoMxhOrders = isLegacyAutoMxhOrdersResource(section.resource);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [pagination, setPagination] = useState<ApiResponse['pagination']>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [perPage, setPerPage] = useState(isLegacySmmServices ? 10 : 25);
  const [providerFilter, setProviderFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pageInput, setPageInput] = useState('1');
  const [loading, setLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [smmMarginDialog, setSmmMarginDialog] = useState<SmmMarginDialogState | null>(null);
  const [editor, setEditor] = useState<{
    mode: 'create' | 'edit';
    row?: Record<string, unknown>;
    values: Record<string, unknown>;
    baseline?: Record<string, unknown>;
    detail?: Record<string, unknown>;
    detailMeta?: Record<string, unknown>;
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
      searchValue?: string;
      statusValue?: string;
      providerValue?: string;
      categoryValue?: string;
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
    const activeSearch = (options?.searchValue ?? search).trim();
    const activeStatus = options?.statusValue ?? status;
    const activeProvider = options?.providerValue ?? providerFilter;
    const activeCategory = options?.categoryValue ?? categoryFilter;
    if (activeSearch) params.set('search', activeSearch);
    if (activeStatus) params.set('status', activeStatus);
    if (isLegacySmmServices && activeProvider) params.set('provider_id', activeProvider);
    if (isLegacySmmServices && activeCategory) params.set('category', activeCategory);

    try {
      const response = await fetch(`/api/admin/${section.resource}?${params.toString()}`, { cache: 'no-store' });
      const payload: ApiResponse = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dữ liệu');
      }
      const nextRows = payload.data || [];
      setRows((current) => (options?.merge ? mergeIncomingRows(current, nextRows) : nextRows));
      setMeta(payload.meta || {});
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
  }, [section.resource, status, search, providerFilter, categoryFilter, editor, pagination?.page, perPage]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedSet.has(rowId(row))), [rows, selectedSet]);
  const smmProviderOptions = useMemo(() => {
    return Array.from(
      new Map(
        rows
          .map((row) => {
            const id = String(row.provider_id || '').trim();
            if (!id) return null;
            return [
              id,
              {
                value: id,
                label: String(row.provider_name || `Provider #${id}`),
              },
            ] as const;
          })
          .filter(Boolean) as Array<readonly [string, { value: string; label: string }]>
      ).values()
    );
  }, [rows]);
  const smmCategoryOptions = useMemo(() => {
    const remoteOptions = Array.isArray(meta.category_options)
      ? meta.category_options.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    return Array.from(
      new Set(
        [...remoteOptions, ...rows
          .map((row) => String(row.category || '').trim())
          .filter(Boolean)]
      )
    ).sort((left, right) => left.localeCompare(right, 'vi'));
  }, [meta, rows]);
  const quickStatusOptions = useMemo(() => getQuickStatusOptions(section.resource), [section.resource]);

  function toggleSelected(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function patchRow(id: number, patch: Record<string, unknown>, successMessage = 'Đã cập nhật') {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/${section.resource}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật');
      }

      const updated = payload.data as Record<string, unknown> | undefined;
      if (updated) {
        setRows((current) => current.map((row) => (rowId(row) === id ? { ...row, ...updated } : row)));
      }
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật');
    } finally {
      setSaving(false);
    }
  }

  async function copyToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('Không thể sao chép vào clipboard');
    }
  }

  function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function resetLegacyBoard() {
    const defaultPageSize = isLegacySmmServices ? 10 : 25;
    setSearch('');
    setStatus('');
    setProviderFilter('');
    setCategoryFilter('');
    setSelected([]);
    setPageInput('1');
    setPerPage(defaultPageSize);
    void loadData(1, {
      pageSize: defaultPageSize,
      searchValue: '',
      statusValue: '',
      providerValue: '',
      categoryValue: '',
    });
  }

  function goToPage(nextPage: number) {
    const target = Math.max(1, Math.min(totalPages, nextPage));
    setPageInput(String(target));
    void loadData(target);
  }

  function submitTypedPage() {
    const nextPage = Math.max(1, Math.min(totalPages, Number(pageInput || page)));
    void loadData(Number.isFinite(nextPage) ? nextPage : page);
  }

  async function saveEditor() {
    if (!editor) return;
    setSaving(true);
    try {
      const id = Number(editor.row?.id || 0);
      const payloadValues = editor.mode === 'edit'
        ? buildDirtyValues(section.resource, editor.baseline || editor.row, editor.values)
        : editor.values;
      const response = await fetch(
        editor.mode === 'create' ? `/api/admin/${section.resource}` : `/api/admin/${section.resource}/${id}`,
        {
          method: editor.mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadValues),
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

  async function openEditor(row?: Record<string, unknown>, mode: 'create' | 'edit' = 'edit') {
    if (mode === 'create') {
      setEditor({
        mode,
        values: hydrateEditorValues(section.resource, createFields),
        baseline: {},
        detail: {},
        detailMeta: {},
      });
      return;
    }

    const baseValues = hydrateEditorValues(section.resource, editableFields, row);
    setEditor({
      mode,
      row,
      values: baseValues,
      baseline: { ...baseValues },
      detail: row || {},
      detailMeta: {},
    });

    if (section.resource !== 'users') {
      return;
    }

    const id = Number(row?.id || 0);
    if (!id) return;

    try {
      const response = await fetch(`/api/admin/${section.resource}/${id}`, { cache: 'no-store' });
      const payload: DetailResponse = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || 'Không thể tải chi tiết user');
      }

      setEditor((current) => {
        if (!current || current.mode !== 'edit' || Number(current.row?.id || 0) !== id) {
          return current;
        }

        const mergedValues = hydrateEditorValues(section.resource, editableFields, payload.data);
        return {
          ...current,
          row: { ...current.row, ...payload.data },
          values: mergedValues,
          baseline: { ...mergedValues },
          detail: payload.data,
          detailMeta: payload.meta || {},
        };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải chi tiết user');
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

  async function toggleSmmService(row: Record<string, unknown>) {
    const id = rowId(row);
    if (!id) return;

    const currentlyActive = isSmmServiceActive(row);
    await patchRow(
      id,
      {
        status: currentlyActive ? 'inactive' : 'active',
        is_deleted: false,
      },
      currentlyActive ? 'Đã tắt dịch vụ SMM' : 'Đã bật dịch vụ SMM'
    );
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

  async function toggleCurrentSmmCategory(nextActive: boolean) {
    const category = categoryFilter.trim();
    if (!category) {
      toast.error('Chọn một danh mục trước khi tắt/bật card');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/${section.resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-category',
          category,
          status: nextActive ? 'active' : 'inactive',
          provider_id: providerFilter || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật danh mục');
      }
      toast.success(nextActive ? 'Đã bật card danh mục' : 'Đã tắt card danh mục');
      await loadData(1, { categoryValue: category, providerValue: providerFilter });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật danh mục');
    } finally {
      setSaving(false);
    }
  }

  function openSmmMarginDialog(scope: SmmMarginScope, row?: Record<string, unknown>) {
    const rowMargin = row?.margin_percent;
    const defaultPercent = rowMargin !== null && rowMargin !== undefined && String(rowMargin).trim() !== ''
      ? String(rowMargin)
      : '30';
    setSmmMarginDialog({ scope, row, percent: defaultPercent });
  }

  async function applySmmMarginPercent() {
    if (!smmMarginDialog) return;

    const marginPercent = Number(smmMarginDialog.percent);
    if (!Number.isFinite(marginPercent) || marginPercent < 0) {
      toast.error('Nhập phần trăm lãi hợp lệ');
      return;
    }

    const scope = smmMarginDialog.scope;
    const singleId = scope === 'single' ? rowId(smmMarginDialog.row || {}) : 0;
    const targetIds = scope === 'single'
      ? (singleId ? [singleId] : [])
      : scope === 'selected'
        ? selected
        : [];

    if ((scope === 'single' || scope === 'selected') && targetIds.length === 0) {
      toast.error(scope === 'single' ? 'Thiếu dịch vụ cần chỉnh' : 'Chọn ít nhất một dịch vụ');
      return;
    }

    if (scope === 'all' || scope === 'filtered' || scope === 'provider') {
      const currentProvider = smmProviderOptions.find((option) => option.value === providerFilter);
      const confirmed = await confirm({
        title: scope === 'all'
          ? 'Áp dụng cho toàn bộ SMM?'
          : scope === 'provider'
            ? 'Áp dụng cho provider hiện tại?'
            : 'Áp dụng cho danh sách đang lọc?',
        description: scope === 'all'
          ? `Toàn bộ dịch vụ SMM sẽ được đặt lãi ${marginPercent}%.`
          : scope === 'provider'
            ? `Toàn bộ dịch vụ của ${currentProvider?.label || 'provider đang chọn'} sẽ được đặt lãi ${marginPercent}%.`
            : `Các dịch vụ khớp bộ lọc hiện tại sẽ được đặt lãi ${marginPercent}%.`,
        confirmText: 'Áp dụng',
        cancelText: 'Hủy',
        tone: 'brand',
      });
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/${section.resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-margin-percent',
          scope,
          percent: marginPercent,
          ids: targetIds,
          search: scope === 'filtered' ? search : undefined,
          status: scope === 'filtered' ? status : undefined,
          provider_id: scope === 'filtered' || scope === 'provider' ? providerFilter : undefined,
          provider_name: scope === 'provider' && !providerFilter ? 'SubMetaVip' : undefined,
          category: scope === 'filtered' ? categoryFilter : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể chỉnh phần trăm lãi');
      }

      toast.success(`Đã chỉnh % lãi cho ${formatNumber(Number(payload.affected || targetIds.length || 0))} dịch vụ`);
      setSmmMarginDialog(null);
      await loadData(pagination?.page || 1, { preserveSelection: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể chỉnh phần trăm lãi');
    } finally {
      setSaving(false);
    }
  }

  const selectedAllOnPage = rows.length > 0 && selected.length === rows.length;

  return (
    <>
      <SectionPanel className={cn(
        'space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900',
        (isLegacySmmServices || isLegacyAutoMxhOrders) && 'rounded-[2rem] border-[#16213c] bg-[#081121] p-5 text-white shadow-[0_30px_90px_-52px_rgba(2,6,23,0.92)]'
      )}>
        {isLegacySmmServices ? (
          <>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                  Administration
                </div>
                <div className="text-3xl font-black uppercase tracking-[-0.04em] text-white">
                  Cấu Hình Dịch Vụ SMM
                </div>
                <p className="max-w-3xl text-sm font-medium leading-7 text-slate-400">
                  Đồng bộ nguồn, lọc danh mục và tinh chỉnh hiển thị dịch vụ theo đúng nhịp vận hành của giao diện cũ.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {globalActions.map((action) => (
                  <Button
                    key={action.key}
                    type="button"
                    size="sm"
                    className="rounded-[1rem] bg-[linear-gradient(135deg,#0ea5e9_0%,#2563eb_52%,#1d4ed8_100%)]"
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
                  className="rounded-[1rem] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                  onClick={() => loadData(pagination?.page || 1, { preserveSelection: true })}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Làm mới
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-[1rem] border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                  disabled={saving}
                  onClick={() => openSmmMarginDialog(selected.length > 0 ? 'selected' : 'filtered')}
                >
                  <Percent className="mr-2 h-4 w-4" />
                  Chỉnh % lãi
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-[1rem] border-orange-400/20 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20"
                  disabled={saving || !categoryFilter.trim()}
                  onClick={() => void toggleCurrentSmmCategory(false)}
                >
                  Tắt card đang lọc
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-[1rem] border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                  disabled={saving || !categoryFilter.trim()}
                  onClick={() => void toggleCurrentSmmCategory(true)}
                >
                  Bật card đang lọc
                </Button>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/8 bg-[#0d1730] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="mb-3 flex flex-wrap gap-2">
                {LEGACY_EDITOR_TOOLBAR.map((Icon, index) => (
                  <button
                    key={`${Icon.displayName || Icon.name}-${index}`}
                    type="button"
                    disabled
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-slate-300"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <div className="rounded-[1.4rem] border border-white/7 bg-[#1b2742] p-4">
                <div className="text-sm font-black uppercase tracking-tight text-slate-100">
                  Cộng Đồng <span className="text-red-400">TRUNGTAMMMO.VN</span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  {LEGACY_COMMUNITY_LINKS.map((item) => (
                    <div key={item.href} className="flex flex-wrap items-center gap-2">
                      <span className="text-emerald-400">❯❯</span>
                      <span className="font-black">{item.label}</span>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-300 underline decoration-sky-300/50 underline-offset-2"
                      >
                        {item.href}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <form
              className="space-y-4 rounded-[1.8rem] border border-white/8 bg-[#0d1730] p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void loadData(1);
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm gói dịch vụ, hashtag..."
                  className="h-14 w-full rounded-[1.25rem] border border-white/8 bg-[#1b2742] pl-12 pr-14 text-sm font-semibold text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[1rem] bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1]"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 xl:grid-cols-[190px_minmax(0,1fr)_150px_190px]">
                <select
                  value={providerFilter}
                  onChange={(event) => {
                    const nextProvider = event.target.value;
                    setProviderFilter(nextProvider);
                    setSelected([]);
                    void loadData(1, { providerValue: nextProvider });
                  }}
                  className="h-14 rounded-[1.2rem] border border-white/8 bg-[#1b2742] px-4 text-sm font-bold text-white outline-none"
                >
                  <option value="">Nguồn: Tất cả</option>
                  {smmProviderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    const nextCategory = event.target.value;
                    setCategoryFilter(nextCategory);
                    setSelected([]);
                    void loadData(1, { categoryValue: nextCategory });
                  }}
                  className="h-14 rounded-[1.2rem] border border-white/8 bg-[#1b2742] px-4 text-sm font-bold text-white outline-none"
                >
                  <option value="">Lọc danh mục</option>
                  {smmCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <select
                  value={String(perPage)}
                  onChange={(event) => {
                    const nextPerPage = Number(event.target.value || 10);
                    setSelected([]);
                    setPerPage(nextPerPage);
                  }}
                  className="h-14 rounded-[1.2rem] border border-white/8 bg-[#1b2742] px-4 text-sm font-bold text-white outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      Hiển thị {option} dòng
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 rounded-[1.2rem] border border-white/8 bg-[#1b2742] px-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Đến trang
                  </span>
                  <input
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ''))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitTypedPage();
                      }
                    }}
                    className="h-11 min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-40"
                      disabled={page <= 1}
                      onClick={() => goToPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-40"
                      disabled={page >= totalPages}
                      onClick={() => goToPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className="flex flex-wrap gap-3">
              {[
                `Tổng ${formatNumber(totalRows)} dòng`,
                `Trang ${page}/${totalPages}`,
                `Đã chọn ${selected.length} dòng`,
                backgroundRefreshing ? 'Đang đồng bộ nền...' : `Cập nhật ${formatCompactClock(lastSyncedAt)}`,
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>

            {selected.length > 0 ? (
              <div className="rounded-[1.6rem] border border-blue-400/20 bg-blue-500/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-sm font-bold text-slate-100">
                    Đã chọn {selected.length} dịch vụ. Bạn có thể cập nhật trạng thái nhanh hoặc ẩn hàng loạt.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-[1rem] border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                      disabled={saving}
                      onClick={() => openSmmMarginDialog('selected')}
                    >
                      <Percent className="mr-2 h-3.5 w-3.5" />
                      Chỉnh % lãi đã chọn
                    </Button>
                    {section.statusOptions?.length ? (
                      <select
                        defaultValue=""
                        onChange={(event) => {
                          void bulkUpdateStatus(event.target.value);
                          event.currentTarget.value = '';
                        }}
                        className="h-10 rounded-[1rem] border border-white/10 bg-white/[0.06] px-3 text-xs font-black uppercase tracking-[0.14em] text-white outline-none"
                      >
                        <option value="">Đổi trạng thái</option>
                        {section.statusOptions.map((option) => (
                          <option key={option} value={option}>{humanizeResourceStatusValue(section.resource, option)}</option>
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

            <div className="overflow-hidden rounded-[1.8rem] border border-white/8 bg-[#0d1730]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-left">
                  <thead className="border-b border-white/8 bg-[#17233e] text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    <tr>
                      <th className="w-12 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedAllOnPage}
                          onChange={(event) => setSelected(event.target.checked ? rows.map((row) => rowId(row)).filter(Boolean) : [])}
                        />
                      </th>
                      <th className="px-4 py-4">Dịch vụ</th>
                      <th className="w-[260px] px-4 py-4">Giá gốc</th>
                      <th className="w-[180px] px-4 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {loading && rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-slate-400">
                          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <EmptyState
                            title="Không có dịch vụ"
                            description="Bộ lọc hiện tại chưa trả về service nào."
                            className="rounded-none border-0 bg-transparent text-white shadow-none"
                          />
                        </td>
                      </tr>
                    ) : rows.map((row) => {
                      const id = rowId(row);
                      const customPrice = toNumber(row.custom_price, 0);
                      const apiRate = toNumber(row.rate, 0);
                      const hasCustomPrice = customPrice > 0;
                      const serviceActive = isSmmServiceActive(row);
                      return (
                        <tr key={id} className="align-top transition hover:bg-white/[0.02]">
                          <td className="px-4 py-5">
                            <input type="checkbox" checked={selectedSet.has(id)} onChange={() => toggleSelected(id)} />
                          </td>
                          <td className="px-4 py-5">
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                                  #{String(row.service_id || row.id || '')}
                                </span>
                                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                                  {String(row.provider_name || `Provider ${row.provider_id || 'N/A'}`)}
                                </span>
                                <span className={cn(
                                  'rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                                  getSmmCategoryAccent(row.category)
                                )}>
                                  {String(row.category || 'Chưa phân loại')}
                                </span>
                                {isTruthy(row.is_auto_margin) ? (
                                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                                    Auto Margin {row.margin_percent ? `${formatCell(row.margin_percent)}%` : ''}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-base font-black leading-7 text-white">
                                {String(row.name || 'Dịch vụ không tên')}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-400">
                                <span>Provider ID: {formatCell(row.provider_id)}</span>
                                <span>Min: {formatCell(row.min)}</span>
                                <span>Max: {formatCell(row.max)}</span>
                                <span>Cập nhật: {formatCompactTimestamp(row.cached_at)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="space-y-2 text-right">
                              <div className="text-2xl font-black tracking-[-0.04em] text-white">
                                {formatPriceValue(hasCustomPrice ? customPrice : apiRate)}
                              </div>
                              <div className="text-xs font-semibold text-slate-400">
                                {hasCustomPrice ? (
                                  <>
                                    Giá API <span className="font-mono line-through">{formatPriceValue(apiRate)}</span>
                                  </>
                                ) : (
                                  <>Giá API {formatPriceValue(apiRate)}</>
                                )}
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <span className={cn(
                                  'inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                                  getLegacyOrderStatusClasses(row.status)
                                )}>
                                  {humanizeResourceStatusValue(section.resource, row.status)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={cn(
                                  'rounded-[1rem] border-white/10 font-black',
                                  serviceActive
                                    ? 'bg-orange-500/10 text-orange-200 hover:bg-orange-500/20'
                                    : 'bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                                )}
                                disabled={saving}
                                onClick={() => void toggleSmmService(row)}
                              >
                                {serviceActive ? 'Tắt' : 'Bật'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-[1rem] border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                                disabled={saving}
                                onClick={() => openSmmMarginDialog('single', row)}
                              >
                                <Percent className="mr-2 h-3.5 w-3.5" />
                                % Lãi
                              </Button>
                              {canEdit ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-[1rem] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                                  onClick={() => void openEditor(row, 'edit')}
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
                                  className="rounded-[1rem] text-slate-300 hover:bg-red-500/10 hover:text-red-300"
                                  disabled={saving}
                                  onClick={() => deleteRow(row)}
                                >
                                  <Trash2 className="h-4 w-4" />
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

            <div className="flex flex-col gap-3 text-xs font-bold text-slate-400 md:flex-row md:items-center md:justify-between">
              <span>
                Hiển thị {visibleFrom}-{visibleTo} / {formatNumber(totalRows)} dòng
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 uppercase tracking-[0.14em] text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Trước
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 uppercase tracking-[0.14em] text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Sau
                  <ChevronRight className="ml-1 h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : isLegacyAutoMxhOrders ? (
          <>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                  Administration
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-4xl font-black uppercase tracking-[-0.08em] text-white">
                    MXH
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                    Live
                  </span>
                </div>
                <div className="text-4xl font-black uppercase tracking-[-0.08em] text-white">
                  Orders
                </div>
                <p className="max-w-xl text-sm font-medium leading-7 text-slate-400">
                  Quản lý đơn hàng dịch vụ Auto MXH theo kiểu card, tab trạng thái và action bar giống giao diện cũ.
                </p>
              </div>

              <form
                className="flex w-full flex-col gap-3 xl:max-w-[820px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadData(1);
                }}
              >
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-[1rem] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    onClick={resetLegacyBoard}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Đặt Lại Bảng
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-[1rem] bg-[linear-gradient(135deg,#14b8a6_0%,#10b981_100%)] text-[#03131a]"
                    onClick={() => {
                      const exportRows = selectedRows.length > 0 ? selectedRows : rows;
                      if (exportRows.length === 0) {
                        toast.error('Không có đơn hàng để xuất');
                        return;
                      }
                      downloadTextFile(`automxh-orders-page-${page}.txt`, formatOrderExportText(exportRows));
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Xuất TXT
                  </Button>
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_120px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Tìm kiếm theo nội dung, tiêu đề, người dùng..."
                      className="h-14 w-full rounded-[1.25rem] border border-white/8 bg-[#0d1730] pl-12 pr-4 text-sm font-semibold text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                  <select
                    value={String(perPage)}
                    onChange={(event) => {
                      const nextPerPage = Number(event.target.value || 25);
                      setSelected([]);
                      setPerPage(nextPerPage);
                    }}
                    className="h-14 rounded-[1.2rem] border border-white/8 bg-[#0d1730] px-4 text-sm font-bold text-white outline-none"
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        Hiển thị {option} dòng
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] border border-white/8 bg-[#0d1730] text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                      disabled={page <= 1}
                      onClick={() => goToPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] border border-white/8 bg-[#0d1730] text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                      disabled={page >= totalPages}
                      onClick={() => goToPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {selected.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-blue-400/20 bg-blue-500/10 px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">
                  Đã chọn {selected.length} đơn hàng
                </div>
                <button
                  type="button"
                  className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-200 transition hover:text-white"
                  onClick={() => setSelected([])}
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-5">
              {LEGACY_ORDER_STATUS_TABS.map((tab) => (
                <button
                  key={tab.value || 'all'}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                  className={cn(
                    'rounded-[1.2rem] border px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] transition',
                    status === tab.value
                      ? 'border-slate-300 bg-slate-300 text-[#0b1220]'
                      : 'border-white/8 bg-[#0d1730] text-slate-300 hover:bg-white/[0.08]'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                `Tổng ${formatNumber(totalRows)} dòng`,
                `Trang ${page}/${totalPages}`,
                `Đã chọn ${selected.length} dòng`,
                backgroundRefreshing ? 'Đang đồng bộ nền...' : `Cập nhật ${formatCompactClock(lastSyncedAt)}`,
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="space-y-4">
              {loading && rows.length === 0 ? (
                <div className="rounded-[1.8rem] border border-white/8 bg-[#0d1730] px-6 py-16 text-center text-slate-400">
                  <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                  Đang tải đơn hàng...
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  title="Không có đơn Auto MXH"
                  description="Bộ lọc hiện tại chưa trả về đơn hàng nào."
                  className="rounded-[1.8rem] border-white/8 bg-[#0d1730] text-white shadow-none"
                />
              ) : rows.map((row) => {
                const id = rowId(row);
                const orderInputs = extractOrderInputRows(row);
                const avatarCandidates = [
                  normalizePublicAssetPath(row.avatar_path),
                  ...parseAssetEntries(row.perfection_image).map((item) => item.url),
                  ...parseAssetEntries(row.additional_files_list || row.additional_files).map((item) => item.url),
                ].filter(Boolean);
                const avatarUrl = avatarCandidates[0] || '';
                const attachmentUrls = Array.from(new Set([
                  ...parseAssetEntries(row.perfection_image).map((item) => item.url),
                  ...parseAssetEntries(row.additional_files_list || row.additional_files).map((item) => item.url),
                ].filter(Boolean)));
                const consentAccepted = isTruthy(row.confirm_1) || isTruthy(row.confirm_2);
                const completionNote = String(row.perfection_content || '').trim();
                return (
                  <article
                    key={id}
                    className="rounded-[1.8rem] border border-white/8 bg-[#0d1730] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(id)}
                          onChange={() => toggleSelected(id)}
                          className="mt-1"
                        />
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3 text-sm font-black text-white">
                            <span>#{id}</span>
                            <span className="text-xs font-bold text-slate-500">{formatCompactTimestamp(row.created_at)}</span>
                          </div>
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-300">
                            {String(row.display_name || row.username || `User #${row.user_id}`)}
                          </div>
                          <div className="text-2xl font-black uppercase leading-tight text-white">
                            {String(row.product_name || `Đơn hàng #${id}`)}
                          </div>
                          <div className="text-sm font-bold uppercase tracking-[0.06em] text-emerald-300">
                            {String(row.variant_name || '').trim() || 'Biến thể mặc định'}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-3 xl:items-end">
                        {section.statusOptions?.length ? (
                          <select
                            value={String(row.status || '')}
                            disabled={saving}
                            onChange={(event) => {
                              void patchRow(id, { status: event.target.value }, `Đã cập nhật trạng thái #${id}`);
                            }}
                            className={cn(
                              'h-11 rounded-[1.1rem] border px-4 text-xs font-black uppercase tracking-[0.16em] outline-none',
                              getLegacyOrderStatusClasses(row.status)
                            )}
                          >
                            {section.statusOptions.map((option) => (
                              <option key={option} value={option}>
                                {humanizeStatusValue(option)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <div className="text-right">
                          <div className="text-3xl font-black tracking-[-0.04em] text-emerald-300">
                            {formatPriceValue(row.price)}
                          </div>
                          {consentAccepted ? (
                            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                              Người dùng đã đồng ý điều khoản
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                      <div className="rounded-[1.5rem] bg-white/[0.04] p-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Dữ liệu đầu vào
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {orderInputs.length > 0 ? orderInputs.map((item) => (
                            <div key={`${id}-${item.label}`} className="rounded-[1rem] border border-white/6 bg-[#111b31] p-3">
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                {item.label}
                              </div>
                              <div className="mt-2 break-all text-sm font-bold text-slate-100">
                                {item.value}
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-[1rem] border border-white/6 bg-[#111b31] p-3 text-sm font-semibold text-slate-400">
                              Không có dữ liệu đầu vào.
                            </div>
                          )}
                        </div>

                        {avatarUrl || attachmentUrls.length > 0 ? (
                          <div className="mt-4 flex flex-wrap items-start gap-3">
                            {avatarUrl ? (
                              <a href={avatarUrl} target="_blank" rel="noreferrer" className="block">
                                <img
                                  src={avatarUrl}
                                  alt={`Avatar đơn #${id}`}
                                  className="h-20 w-20 rounded-[1rem] border border-white/8 object-cover"
                                />
                              </a>
                            ) : null}
                            {attachmentUrls.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-200"
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                File
                              </a>
                            ))}
                          </div>
                        ) : null}

                        {completionNote ? (
                          <div className="mt-4 rounded-[1rem] border border-emerald-400/12 bg-emerald-500/6 p-3 text-sm font-semibold text-emerald-100">
                            {completionNote}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-3 xl:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-[1rem] bg-[linear-gradient(135deg,#0ea5e9_0%,#2563eb_100%)]"
                          onClick={() => copyToClipboard(formatOrderClipboardText(row), `Đã sao chép nội dung đơn #${id}`)}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Gửi Tele
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-[1rem] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                          onClick={() => void openEditor(row, 'edit')}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Sửa
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {selected.length > 0 ? (
              <div className="sticky bottom-4 z-20">
                <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 rounded-[1.8rem] border border-white/10 bg-[#111b31]/95 px-5 py-4 shadow-[0_24px_60px_-28px_rgba(2,6,23,0.8)] backdrop-blur-xl">
                  <div className="rounded-full bg-blue-500 px-3 py-2 text-sm font-black text-white">
                    {selected.length}
                  </div>
                  <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-200">
                    Đơn hàng được chọn
                  </div>
                  {section.statusOptions?.length ? (
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        void bulkUpdateStatus(event.target.value);
                        event.currentTarget.value = '';
                      }}
                      className="h-11 rounded-[1rem] border border-white/10 bg-white/[0.05] px-4 text-xs font-black uppercase tracking-[0.14em] text-white outline-none"
                    >
                      <option value="">Đổi trạng thái</option>
                      {section.statusOptions.map((option) => (
                        <option key={option} value={option}>{humanizeResourceStatusValue(section.resource, option)}</option>
                      ))}
                    </select>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-[1rem] bg-[linear-gradient(135deg,#3b82f6_0%,#2563eb_100%)]"
                    onClick={() => copyToClipboard(formatOrderExportText(selectedRows), 'Đã sao chép các đơn đã chọn')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Sao Chép
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-[1rem] bg-[linear-gradient(135deg,#0ea5e9_0%,#06b6d4_100%)]"
                    onClick={() => copyToClipboard(formatOrderExportText(selectedRows), 'Đã chuẩn bị nội dung Telegram')}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Gửi Telegram Hàng Loạt
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-[1rem] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    onClick={() => downloadTextFile(`automxh-selected-${page}.txt`, formatOrderExportText(selectedRows))}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Xuất TXT
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
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
                      onClick={() => void openEditor(undefined, 'create')}
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
                    <option key={option} value={option}>{humanizeResourceStatusValue(section.resource, option)}</option>
                  ))}
                </select>
              ) : null}
              <Button type="submit" size="default" className="w-full lg:w-auto">
                <Search className="mr-2 h-4 w-4" />
                Lọc dữ liệu
              </Button>
            </form>

            {quickStatusOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {quickStatusOptions.map((option) => (
                  <Button
                    key={`${section.resource}-${option.value || 'all'}`}
                    type="button"
                    size="sm"
                    variant={status === option.value ? 'default' : 'outline'}
                    onClick={() => setStatus(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            ) : null}

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
                          <option key={option} value={option}>{humanizeResourceStatusValue(section.resource, option)}</option>
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
                          checked={selectedAllOnPage}
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
                                isLongTextField(column) && 'min-w-[260px] max-w-[380px] whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
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
                              ) : formatCell(resolveDisplayValue(row, column), column)}
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
                                  onClick={() => void openEditor(row, 'edit')}
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
          </>
        )}
      </SectionPanel>

      {editor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            className={cn(
              'max-h-[90vh] w-full overflow-y-auto shadow-2xl',
              isLegacyAutoMxhOrders
                ? 'max-w-4xl rounded-[1.9rem] border border-white/8 bg-[#171717] p-6 text-white'
                : 'max-w-2xl rounded-[12px] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#1a1a1a]'
            )}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className={cn(
                  'text-xl font-black uppercase tracking-[-0.04em]',
                  isLegacyAutoMxhOrders ? 'text-white' : 'text-slate-900 dark:text-white'
                )}>
                  {editor.mode === 'create' ? 'Thêm mới' : `Sửa #${editor.row?.id}`}
                </h3>
                <p className={cn(
                  'mt-1 text-sm font-medium',
                  isLegacyAutoMxhOrders ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
                )}>{localizeAdminText(section.title)}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(isLegacyAutoMxhOrders && 'rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]')}
                onClick={() => setEditor(null)}
              >
                Đóng
              </Button>
            </div>

            <div className={cn('grid gap-4 sm:grid-cols-2', isLegacyAutoMxhOrders && 'gap-5')}>
              {sortAutomxhEditorEntries(Object.entries(editor.values)).filter(([field]) => !shouldHideEditorField(section.resource, field)).map(([field, fieldValue]) => (
                <label key={field} className="space-y-2">
                  <span className={cn(
                    'text-[10px] font-black uppercase tracking-[0.26em]',
                    isLegacyAutoMxhOrders ? 'text-slate-500' : 'text-slate-400'
                  )}>
                    {humanizeFieldName(field)}
                  </span>
                  {field === 'status' && section.statusOptions?.length ? (
                    <select
                      value={String(fieldValue ?? '')}
                      onChange={(event) => setEditor((current) => current ? {
                        ...current,
                        values: { ...current.values, [field]: event.target.value },
                      } : current)}
                      className={cn(
                        'w-full px-3 py-2 text-sm font-bold outline-none transition-all',
                        isLegacyAutoMxhOrders
                          ? 'rounded-[1rem] border border-white/8 bg-[#232323] text-white'
                          : 'rounded-[9px] border border-slate-200 bg-white dark:border-white/10 dark:bg-[#111] dark:text-white'
                      )}
                    >
                      {section.statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {humanizeResourceStatusValue(section.resource, option)}
                        </option>
                      ))}
                    </select>
                  ) : field === 'name_color' ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={normalizeHexColor(fieldValue) || '#ffffff'}
                        onChange={(event) => setEditor((current) => current ? {
                          ...current,
                          values: { ...current.values, [field]: event.target.value },
                        } : current)}
                        className="h-10 w-14 cursor-pointer rounded-[9px] border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#111]"
                      />
                      <Input
                        value={String(fieldValue ?? '')}
                        onChange={(event) => setEditor((current) => current ? {
                          ...current,
                          values: { ...current.values, [field]: event.target.value },
                        } : current)}
                        placeholder="#ffffff"
                        className={cn(isLegacyAutoMxhOrders && 'rounded-[1rem] border-white/8 bg-[#232323] text-white placeholder:text-slate-500')}
                      />
                    </div>
                  ) : isLongTextField(field) ? (
                    <textarea
                      value={String(fieldValue ?? '')}
                      onChange={(event) => setEditor((current) => current ? {
                        ...current,
                        values: { ...current.values, [field]: event.target.value },
                      } : current)}
                      rows={4}
                      className={cn(
                        'w-full px-3 py-2 text-sm font-bold outline-none transition-all',
                        isLegacyAutoMxhOrders
                          ? 'rounded-[1rem] border border-white/8 bg-[#232323] text-white'
                          : 'rounded-[9px] border border-slate-200 bg-white dark:border-white/10 dark:bg-[#111] dark:text-white'
                      )}
                    />
                  ) : (
                    <Input
                      value={String(fieldValue ?? '')}
                      onChange={(event) => setEditor((current) => current ? {
                        ...current,
                        values: { ...current.values, [field]: event.target.value },
                      } : current)}
                      className={cn(isLegacyAutoMxhOrders && 'rounded-[1rem] border-white/8 bg-[#232323] text-white placeholder:text-slate-500')}
                    />
                  )}
                </label>
              ))}
            </div>

            {section.resource === 'users' ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Username', value: String(editor.detail?.username || editor.row?.username || '—') },
                    { label: 'Trạng thái', value: humanizeStatusValue(editor.detail?.status || editor.row?.status) },
                    { label: 'Số dư', value: formatPriceValue(editor.detail?.balance || editor.row?.balance) },
                    { label: 'Ví game', value: formatPriceValue(editor.detail?.game_balance || editor.row?.game_balance) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[9px] border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</div>
                      <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {[
                    { key: 'activity_history', title: 'Lịch sử hoạt động' },
                    { key: 'recent_transactions', title: 'Giao dịch gần đây' },
                    { key: 'smm_orders', title: 'Đơn SMM gần đây' },
                    { key: 'automxh_orders', title: 'Đơn Auto MXH gần đây' },
                    { key: 'audit_logs', title: 'Nhật ký admin' },
                    { key: 'private_messages', title: 'Tin nhắn admin' },
                  ].map((block) => {
                    const items = detailEntries(editor.detailMeta?.[block.key]);
                    return (
                      <div key={block.key} className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {block.title}
                        </div>
                        <div className="space-y-2">
                          {items.length === 0 ? (
                            <div className="rounded-[9px] border border-dashed border-slate-200 px-3 py-4 text-sm font-semibold text-slate-400 dark:border-white/10">
                              Chưa có dữ liệu.
                            </div>
                          ) : items.map((item, index) => (
                            <div key={`${block.key}-${item.id || index}`} className="rounded-[9px] border border-slate-200 bg-white px-3 py-3 dark:border-white/8 dark:bg-[#111]">
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {renderTimelineValue(item)}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400">
                                {'status' in item ? <span>{humanizeStatusValue(item.status)}</span> : null}
                                {'amount' in item ? <span>{formatPriceValue(item.amount)}</span> : null}
                                {'price' in item ? <span>{formatPriceValue(item.price)}</span> : null}
                                <span>{formatCompactTimestamp(item.created_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className={cn(isLegacyAutoMxhOrders && 'rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]')}
                onClick={() => setEditor(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={saving}
                loading={saving}
                loadingText="Đang lưu..."
                className={cn(isLegacyAutoMxhOrders && 'rounded-full bg-[linear-gradient(135deg,#2563eb_0%,#38bdf8_100%)] text-white')}
                onClick={saveEditor}
              >
                {!saving ? <Save className="mr-2 h-4 w-4" /> : null}
                Lưu
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {smmMarginDialog ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[1.75rem] border border-white/10 bg-[#081121] p-6 text-white shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-300">
                  SMM Profit Margin
                </div>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.04em]">
                  Chỉnh phần trăm lãi
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                  Giá bán sẽ được tính lại theo công thức: giá API x (1 + % lãi / 100).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-[1rem] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                onClick={() => setSmmMarginDialog(null)}
              >
                Đóng
              </Button>
            </div>

            {smmMarginDialog.row ? (
              <div className="mb-4 rounded-[1.2rem] border border-white/8 bg-white/[0.04] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Dịch vụ riêng lẻ</div>
                <div className="mt-2 line-clamp-2 text-sm font-black text-slate-100">
                  #{String(smmMarginDialog.row.service_id || smmMarginDialog.row.id || '')} · {String(smmMarginDialog.row.name || 'Dịch vụ SMM')}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Phạm vi áp dụng
                </span>
                <select
                  value={smmMarginDialog.scope}
                  onChange={(event) => setSmmMarginDialog((current) => current ? {
                    ...current,
                    scope: event.target.value as SmmMarginScope,
                    row: event.target.value === 'single' ? current.row : undefined,
                  } : current)}
                  className="h-12 w-full rounded-[1rem] border border-white/10 bg-[#101b33] px-4 text-sm font-black text-white outline-none"
                >
                  {smmMarginDialog.row ? (
                    <option value="single">Dịch vụ này</option>
                  ) : null}
                  <option value="selected" disabled={selected.length === 0}>
                    Dịch vụ đã chọn ({selected.length})
                  </option>
                  <option value="filtered">Danh sách đang lọc</option>
                  <option value="provider">
                    {providerFilter
                      ? `Toàn bộ ${smmProviderOptions.find((option) => option.value === providerFilter)?.label || 'provider đang chọn'}`
                      : 'Toàn bộ SubMetaVip'}
                  </option>
                  <option value="all">Toàn bộ dịch vụ SMM</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                  % lãi
                </span>
                <div className="relative">
                  <input
                    value={smmMarginDialog.percent}
                    onChange={(event) => setSmmMarginDialog((current) => current ? {
                      ...current,
                      percent: event.target.value.replace(/[^\d.]/g, ''),
                    } : current)}
                    placeholder="30"
                    className="h-12 w-full rounded-[1rem] border border-white/10 bg-[#101b33] px-4 pr-10 text-sm font-black text-white outline-none placeholder:text-slate-600"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">%</span>
                </div>
              </label>
            </div>

            <div className="mt-4 rounded-[1.2rem] border border-sky-400/15 bg-sky-500/10 p-4 text-sm font-semibold leading-6 text-sky-100">
              {smmMarginDialog.scope === 'all'
                ? 'Áp dụng cho toàn bộ service SMM trong database.'
                : smmMarginDialog.scope === 'filtered'
                  ? 'Áp dụng cho tất cả service khớp search/provider/category/status hiện tại.'
                  : smmMarginDialog.scope === 'provider'
                    ? providerFilter
                      ? 'Áp dụng cho toàn bộ service thuộc provider đang chọn, bỏ qua phân trang hiện tại.'
                      : 'Áp dụng cho toàn bộ service SubMetaVip, bỏ qua phân trang hiện tại.'
                  : smmMarginDialog.scope === 'selected'
                    ? `Áp dụng cho ${selected.length} service đang tick chọn.`
                    : 'Chỉ áp dụng cho service riêng lẻ này.'}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-[1rem] border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                onClick={() => setSmmMarginDialog(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                disabled={saving}
                loading={saving}
                loadingText="Đang áp dụng..."
                className="rounded-[1rem] bg-[linear-gradient(135deg,#2563eb_0%,#38bdf8_100%)] text-white"
                onClick={() => void applySmmMarginPercent()}
              >
                {!saving ? <Percent className="mr-2 h-4 w-4" /> : null}
                Áp dụng % lãi
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
