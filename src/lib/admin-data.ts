import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/admin-auth';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { ensureFindJobPinColumn, resolveFindJobTable } from '@/lib/find-job';
import { isTrackableIp } from '@/lib/ip-security';
import { invalidateLegacySettingsCache } from '@/lib/legacy-settings';
import { reconcilePendingSePayDeposits } from '@/lib/sepay-deposit-sync';
import { toNumber } from '@/lib/utils';

type SortOrder = 'asc' | 'desc';

interface ResourceConfig {
  delegate?: string;
  table?: string;
  title: string;
  searchFields: string[];
  statusField?: string;
  defaultOrder?: Record<string, SortOrder>;
  select?: Record<string, boolean | Record<string, unknown>>;
  include?: Record<string, unknown>;
  createFields?: string[];
  updateFields?: string[];
  readonly?: boolean;
  rawOrder?: string;
}

const commonOrder = { id: 'desc' as const };
const rawTableColumnCache = new Map<string, Set<string>>();

export const adminResourceConfig: Record<string, ResourceConfig> = {
  users: {
    delegate: 'users',
    title: 'Người dùng',
    searchFields: ['username', 'email', 'fullname', 'rank'],
    statusField: 'status',
    defaultOrder: commonOrder,
    select: {
      id: true,
      username: true,
      email: true,
      fullname: true,
      role: true,
      status: true,
      balance: true,
      rank: true,
      last_ip: true,
      last_login: true,
      lock_reason: true,
      created_at: true,
    },
    createFields: ['username', 'email', 'password', 'fullname', 'role', 'status', 'balance', 'rank'],
    updateFields: ['fullname', 'email', 'role', 'status', 'balance', 'rank', 'lock_reason', 'locked_until', 'is_blue_tick'],
  },
  deposits: {
    delegate: 'transactions',
    title: 'Nạp tiền',
    searchFields: ['content'],
    statusField: 'status',
    defaultOrder: commonOrder,
    select: {
      id: true,
      user_id: true,
      amount: true,
      balance_after: true,
      content: true,
      type: true,
      status: true,
      created_at: true,
    },
    updateFields: ['status', 'content', 'amount'],
  },
  transactions: {
    delegate: 'transactions',
    title: 'Giao dịch hệ thống',
    searchFields: ['content', 'type', 'status'],
    statusField: 'status',
    defaultOrder: commonOrder,
  },
  'smm-services': {
    delegate: 'smm_services_cache',
    title: 'Dịch vụ SMM',
    searchFields: ['name', 'original_name', 'category', 'type'],
    statusField: 'status',
    defaultOrder: commonOrder,
    updateFields: ['custom_price', 'status', 'is_deleted', 'is_auto_margin', 'margin_percent', 'description', 'server_info'],
  },
  'smm-orders': {
    delegate: 'smm_orders',
    title: 'Đơn SMM',
    searchFields: ['api_order_id', 'service_name', 'link', 'status'],
    statusField: 'status',
    defaultOrder: commonOrder,
    updateFields: ['status', 'reason', 'is_refunded', 'refund_amount', 'start_count', 'remains'],
  },
  providers: {
    delegate: 'api_providers',
    title: 'API providers',
    searchFields: ['name', 'type', 'service_type', 'api_url', 'status'],
    statusField: 'status',
    defaultOrder: commonOrder,
    createFields: ['name', 'type', 'service_type', 'is_per_unit', 'exchange_rate', 'api_key', 'api_url', 'status', 'balance_alert_threshold'],
    updateFields: ['name', 'type', 'service_type', 'is_per_unit', 'exchange_rate', 'api_key', 'api_url', 'status', 'health_status', 'balance_alert_threshold'],
  },
  'automxh-categories': {
    table: 'automxh_categories',
    title: 'Auto MXH categories',
    searchFields: ['name', 'slug', 'status'],
    statusField: 'status',
    rawOrder: 'sort_order ASC, id ASC',
    createFields: ['name', 'slug', 'icon', 'gif', 'sort_order', 'status'],
    updateFields: ['name', 'slug', 'icon', 'gif', 'sort_order', 'status', 'is_deleted'],
  },
  'automxh-products': {
    table: 'automxh_products',
    title: 'Auto MXH products',
    searchFields: ['name', 'description', 'status', 'type'],
    statusField: 'status',
    rawOrder: 'updated_at DESC, id DESC',
    createFields: ['category_id', 'api_provider_id', 'api_service_id', 'name', 'slug', 'price', 'cost', 'type', 'description', 'input_label', 'input_placeholder', 'buyer_label', 'buyer_placeholder', 'custom_inputs', 'status'],
    updateFields: ['category_id', 'api_provider_id', 'api_service_id', 'name', 'slug', 'price', 'cost', 'type', 'description', 'input_label', 'input_placeholder', 'buyer_label', 'buyer_placeholder', 'custom_inputs', 'status', 'is_deleted'],
  },
  'automxh-orders': {
    table: 'automxh_orders',
    title: 'Auto MXH orders',
    searchFields: ['api_order_id', 'link', 'buyer_info', 'status'],
    statusField: 'status',
    rawOrder: 'updated_at DESC, id DESC',
    updateFields: ['status', 'price', 'cost_price', 'buyer_info', 'api_order_id', 'api_response', 'api_status_log', 'perfection_content', 'perfection_image', 'avatar_path', 'additional_files', 'confirm_1', 'confirm_2', 'is_exported'],
  },
  'automxh-variants': {
    table: 'automxh_variants',
    title: 'Auto MXH variants',
    searchFields: ['name', 'description', 'badge', 'type', 'status'],
    statusField: 'status',
    rawOrder: 'updated_at DESC, id DESC',
    createFields: ['product_id', 'api_provider_id', 'api_service_id', 'quantity', 'name', 'price', 'cost', 'original_price', 'description', 'badge', 'type', 'status', 'allow_avatar', 'allow_files'],
    updateFields: ['product_id', 'api_provider_id', 'api_service_id', 'quantity', 'name', 'price', 'cost', 'original_price', 'description', 'badge', 'type', 'status', 'allow_avatar', 'allow_files', 'is_deleted'],
  },
  resources: {
    table: 'mmo_resources',
    title: 'Tài nguyên MMO',
    searchFields: ['title', 'category', 'description', 'status', 'product_code'],
    statusField: 'status',
    rawOrder: 'is_pinned DESC, display_order ASC, updated_at DESC, id DESC',
    createFields: ['product_code', 'title', 'description', 'category', 'category_id', 'price', 'original_price', 'thumbnail', 'resource_type', 'stock', 'download_url', 'content', 'product_content', 'product_note', 'tags', 'status', 'featured', 'is_pinned', 'created_by', 'api_provider_id', 'api_product_id', 'is_auto', 'is_auto_margin', 'margin_percent', 'custom_badge', 'display_order'],
    updateFields: ['product_code', 'title', 'description', 'category', 'category_id', 'price', 'original_price', 'thumbnail', 'resource_type', 'stock', 'sold_count', 'download_url', 'content', 'product_content', 'product_note', 'tags', 'status', 'featured', 'is_pinned', 'api_provider_id', 'api_product_id', 'is_auto', 'is_auto_margin', 'margin_percent', 'custom_badge', 'display_order', 'is_deleted'],
  },
  'resource-categories': {
    table: 'resource_categories',
    title: 'Resource categories',
    searchFields: ['name', 'slug', 'description', 'status'],
    statusField: 'status',
    rawOrder: 'display_order ASC, id ASC',
    createFields: ['parent_id', 'name', 'slug', 'icon', 'image', 'description', 'display_order', 'status', 'api_provider_id', 'api_category_id'],
    updateFields: ['parent_id', 'name', 'slug', 'icon', 'image', 'description', 'display_order', 'status', 'is_deleted', 'api_provider_id', 'api_category_id'],
  },
  'resource-orders': {
    table: 'resource_orders',
    title: 'Đơn tài nguyên',
    searchFields: ['status', 'payment_method'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'total_price', 'quantity', 'payment_method', 'download_count', 'max_downloads', 'expires_at', 'delivery_data', 'is_exported', 'exported_at'],
  },
  'card-orders': {
    table: 'card_orders',
    title: 'Đơn thẻ cào',
    searchFields: ['telco', 'serial', 'status', 'api_order_id'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'note', 'amount', 'api_order_id'],
  },
  'card-rates': {
    table: 'card_rates',
    title: 'Card rates',
    searchFields: ['telco', 'type'],
    statusField: 'is_active',
    rawOrder: 'telco ASC, value ASC',
    createFields: ['telco', 'value', 'rate_exchange', 'rate_buy', 'type', 'is_active'],
    updateFields: ['telco', 'value', 'rate_exchange', 'rate_buy', 'type', 'is_active'],
  },
  'forum-categories': {
    table: 'forum_categories',
    title: 'Forum categories',
    searchFields: ['name', 'description'],
    rawOrder: 'priority ASC, id ASC',
    createFields: ['name', 'description', 'priority'],
    updateFields: ['name', 'description', 'priority'],
  },
  'forum-forums': {
    table: 'forums',
    title: 'Forum folders',
    searchFields: ['name', 'slug', 'description'],
    rawOrder: 'category_id ASC, priority ASC, id ASC',
    createFields: ['category_id', 'parent_id', 'name', 'slug', 'description', 'icon', 'priority', 'allowed_posting_roles'],
    updateFields: ['category_id', 'parent_id', 'name', 'slug', 'description', 'icon', 'priority', 'allowed_posting_roles', 'last_post_id'],
  },
  'forum-threads': {
    table: 'forum_threads',
    title: 'Forum threads',
    searchFields: ['title', 'slug', 'status'],
    statusField: 'status',
    rawOrder: 'is_pinned DESC, updated_at DESC, id DESC',
    createFields: ['forum_id', 'user_id', 'title', 'slug', 'status', 'is_pinned', 'is_locked'],
    updateFields: ['forum_id', 'user_id', 'title', 'slug', 'status', 'is_pinned', 'is_locked', 'is_deleted'],
  },
  'forum-posts': {
    table: 'forum_posts',
    title: 'Forum posts',
    searchFields: ['content', 'status'],
    statusField: 'status',
    rawOrder: 'id DESC',
    updateFields: ['content', 'status', 'is_deleted'],
  },
  'forum-ads': {
    table: 'forum_ads',
    title: 'Forum ads',
    searchFields: ['status', 'link_url', 'reject_reason'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    createFields: ['user_id', 'status', 'price_vnd', 'duration_days', 'image_path', 'link_url', 'reject_reason', 'active_from', 'active_to', 'admin_id'],
    updateFields: ['status', 'price_vnd', 'duration_days', 'image_path', 'link_url', 'reject_reason', 'uploaded_at', 'approved_at', 'active_from', 'active_to', 'admin_id'],
  },
  'forum-reports': {
    table: 'forum_reports',
    title: 'Forum reports',
    searchFields: ['reason', 'details', 'status'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'details'],
  },
  'forum-badges': {
    table: 'forum_badges',
    title: 'Forum badges',
    searchFields: ['name', 'description', 'criteria_type'],
    rawOrder: 'id DESC',
    createFields: ['name', 'icon', 'color', 'description', 'criteria_type', 'criteria_value'],
    updateFields: ['name', 'icon', 'color', 'description', 'criteria_type', 'criteria_value'],
  },
  'forum-prefixes': {
    table: 'forum_prefixes',
    title: 'Forum prefixes',
    searchFields: ['name', 'color'],
    rawOrder: 'priority ASC, id ASC',
    createFields: ['name', 'color', 'priority'],
    updateFields: ['name', 'color', 'priority'],
  },
  'game-orders': {
    table: 'game_market_orders',
    title: 'Game market orders',
    searchFields: ['status', 'delivered_data', 'review'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    createFields: ['id', 'buyer_id', 'seller_id', 'item_id', 'stock_id', 'amount', 'delivered_data', 'status'],
    updateFields: ['buyer_id', 'seller_id', 'item_id', 'stock_id', 'amount', 'delivered_data', 'status', 'rating', 'review'],
  },
  'game-items': {
    table: 'game_market_items',
    title: 'Game market items',
    searchFields: ['title', 'category', 'tag', 'status'],
    statusField: 'status',
    rawOrder: 'is_pinned DESC, created_at DESC, id DESC',
    createFields: ['id', 'code', 'seller_id', 'title', 'category', 'tag', 'badge', 'badge_color', 'price', 'stock', 'prep_time', 'accounts_stock', 'original_price', 'thumbnail', 'description', 'images', 'features', 'rank', 'skins', 'champs', 'account_details', 'status', 'delivery_method', 'is_pinned', 'pinned_until'],
    updateFields: ['code', 'seller_id', 'title', 'category', 'tag', 'badge', 'badge_color', 'price', 'stock', 'prep_time', 'accounts_stock', 'original_price', 'thumbnail', 'description', 'images', 'features', 'rank', 'skins', 'champs', 'account_details', 'status', 'delivery_method', 'is_pinned', 'pinned_until'],
  },
  'find-jobs': {
    table: 'find_jobs',
    title: 'Find Job MMO',
    searchFields: ['title', 'description', 'status'],
    statusField: 'status',
    rawOrder: 'is_pinned DESC, updated_at DESC, id DESC',
    createFields: ['user_id', 'posted_by', 'title', 'slug', 'description', 'category', 'budget_min', 'price_min', 'budget_max', 'price_max', 'deadline_days', 'status', 'approval_status', 'is_pinned'],
    updateFields: ['title', 'slug', 'description', 'category', 'budget_min', 'price_min', 'budget_max', 'price_max', 'deadline_days', 'status', 'approval_status', 'is_pinned'],
  },
  settings: {
    delegate: 'settings',
    title: 'Settings',
    searchFields: ['setting_key', 'setting_value'],
    defaultOrder: commonOrder,
    createFields: ['setting_key', 'setting_value'],
    updateFields: ['setting_value'],
  },
  'activity-logs': {
    delegate: 'activity_logs',
    title: 'Activity logs',
    searchFields: ['activity', 'ip_address', 'user_agent'],
    defaultOrder: commonOrder,
    include: { user: { select: { username: true, role: true } } },
    readonly: true,
  },
  'admin-audit-logs': {
    table: 'admin_audit_logs',
    title: 'Admin audit logs',
    searchFields: ['action', 'description', 'ip_address'],
    rawOrder: 'created_at DESC, id DESC',
    readonly: true,
  },
  'registration-ips': {
    title: 'IP đăng ký',
    searchFields: ['ip', 'sample_users'],
    defaultOrder: commonOrder,
    readonly: true,
  },
  'ip-blacklist': {
    delegate: 'ip_blacklist',
    title: 'IP blacklist',
    searchFields: ['ip_address', 'reason'],
    defaultOrder: commonOrder,
    createFields: ['ip_address', 'reason'],
    updateFields: ['ip_address', 'reason'],
  },
  'banned-ips': {
    delegate: 'banned_ips',
    title: 'Banned IPs',
    searchFields: ['ip', 'reason'],
    defaultOrder: commonOrder,
    createFields: ['ip', 'reason', 'banned_by', 'user_id', 'expire_at'],
    updateFields: ['ip', 'reason', 'banned_by', 'user_id', 'expire_at'],
  },
  'security-logs': {
    delegate: 'security_logs',
    title: 'Security logs',
    searchFields: ['event_type', 'ip', 'uri', 'payload', 'user_agent'],
    defaultOrder: commonOrder,
    readonly: true,
  },
  banks: {
    table: 'banks',
    title: 'Banks',
    searchFields: ['name', 'account_name', 'account_number'],
    defaultOrder: commonOrder,
    createFields: ['name', 'account_name', 'account_number', 'is_active'],
    updateFields: ['name', 'account_name', 'account_number', 'is_active'],
  },
  'bank-logs': {
    table: 'bank_api_logs',
    title: 'Bank API logs',
    searchFields: ['request_data', 'response_data', 'status', 'message'],
    defaultOrder: commonOrder,
    readonly: true,
  },
  'tiktok-orders': {
    table: 'tiktok_support_orders',
    title: 'Support TikTok orders',
    searchFields: ['region', 'service_key', 'service_name', 'tiktok_id', 'buyer_name', 'buyer_contact', 'status'],
    statusField: 'status',
    rawOrder: 'updated_at DESC, id DESC',
    createFields: ['user_id', 'region', 'service_key', 'service_name', 'tiktok_id', 'buyer_name', 'buyer_contact', 'price', 'status', 'ngay_gia_han', 'ngay_het_han'],
    updateFields: ['region', 'service_key', 'service_name', 'tiktok_id', 'buyer_name', 'buyer_contact', 'price', 'status', 'ngay_gia_han', 'ngay_het_han'],
  },
  'tiktok-service-menus': {
    table: 'tiktok_service_menus',
    title: 'Support TikTok menus',
    searchFields: ['name', 'slug', 'status'],
    statusField: 'status',
    rawOrder: 'display_order ASC, id ASC',
    createFields: ['name', 'slug', 'display_order', 'status'],
    updateFields: ['name', 'slug', 'display_order', 'status'],
  },
  'tiktok-region-services': {
    table: 'tiktok_region_services',
    title: 'Support TikTok region services',
    searchFields: ['region_slug', 'name', 'service_key', 'description', 'status'],
    statusField: 'status',
    rawOrder: 'region_slug ASC, display_order ASC, id ASC',
    createFields: ['region_slug', 'name', 'service_key', 'price', 'description', 'display_order', 'status'],
    updateFields: ['region_slug', 'name', 'service_key', 'price', 'description', 'display_order', 'status'],
  },
  'admin-private-messages': {
    table: 'admin_private_messages',
    title: 'Admin private messages',
    searchFields: ['message', 'status'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    createFields: ['admin_id', 'user_id', 'message', 'show_limit', 'shown_count', 'status'],
    updateFields: ['message', 'show_limit', 'shown_count', 'status'],
  },
  'message-reports': {
    table: 'message_reports',
    title: 'Message reports',
    searchFields: ['reason', 'status'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status'],
  },
  'accounting-extra': {
    table: 'accounting_extra',
    title: 'Accounting extra',
    searchFields: ['type', 'note', 'status'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    createFields: ['type', 'amount', 'note', 'status'],
    updateFields: ['type', 'amount', 'note', 'status'],
  },
  'interface-settings': {
    table: 'interface_settings',
    title: 'Interface settings',
    searchFields: ['setting_key', 'setting_value'],
    rawOrder: 'id DESC',
    createFields: ['setting_key', 'setting_value'],
    updateFields: ['setting_value'],
  },
  'mmo-api': {
    table: 'mmo_api',
    title: 'MMO API legacy',
    searchFields: ['name', 'category', 'status'],
    statusField: 'status',
    rawOrder: 'updated_at DESC, id DESC',
    updateFields: ['name', 'category', 'price', 'margin_percent', 'status'],
  },
  'mmo-resources-sales': {
    table: 'mmo_resources_sales',
    title: 'MMO resources sales legacy',
    searchFields: ['status', 'buyer_email', 'note'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'note'],
  },
};

function getConfig(resource: string) {
  const config = adminResourceConfig[resource];
  if (!config) {
    throw new Error('Resource không được hỗ trợ');
  }
  return config;
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return serializeDatabaseDateTime(value);
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    if ('toNumber' in value && typeof value.toNumber === 'function') {
      return toNumber(value, 0);
    }

    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = normalizeValue(item);
    }
    return output;
  }

  return value;
}

function sanitizeData(input: Record<string, unknown>, allowedFields: string[] = []) {
  const output: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      output[field] = coerceInput(input[field]);
    }
  }
  return output;
}

function coerceInput(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return '';
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return new Date(trimmed);
  return trimmed;
}

function getDelegate(config: ResourceConfig) {
  if (!config.delegate) {
    return null;
  }
  return (db as unknown as Record<string, any>)[config.delegate];
}

function buildPrismaWhere(resource: string, config: ResourceConfig, params: URLSearchParams) {
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const where: Record<string, unknown> = {};

  if (search && config.searchFields.length > 0) {
    const numericSearch = Number(search);
    where.OR = [
      ...config.searchFields.map((field) => ({ [field]: { contains: search } })),
      ...(!Number.isNaN(numericSearch) ? [{ id: numericSearch }, { user_id: numericSearch }] : []),
    ];
  }

  if (status && config.statusField) {
    where[config.statusField] = status;
  }

  if (config.delegate === 'transactions' && resource === 'deposits') {
    where.type = 'deposit';
  }

  return where;
}

export async function listAdminResource(resource: string, params: URLSearchParams) {
  const config = getConfig(resource);
  const page = Math.max(1, Number(params.get('page') || 1));
  const perPage = Math.min(100, Math.max(5, Number(params.get('per_page') || 25)));
  const skip = (page - 1) * perPage;

  if (resource === 'deposits') {
    await reconcilePendingSePayDeposits({
      limit: Math.min(perPage, 30),
    }).catch(() => null);
  }

  if (resource === 'registration-ips') {
    return listRegistrationIps(config, params, page, perPage, skip);
  }

  if (config.table) {
    return listRawTable(config, params, page, perPage, skip);
  }

  const delegate = getDelegate(config);
  if (!delegate) {
    throw new Error('Resource chưa có delegate');
  }

  const where = buildPrismaWhere(resource, config, params);
  const [rows, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy: config.defaultOrder || commonOrder,
      skip,
      take: perPage,
      ...(config.select ? { select: config.select } : {}),
      ...(config.include ? { include: config.include } : {}),
    }),
    delegate.count({ where }),
  ]);

  return {
    success: true,
    title: config.title,
    data: normalizeValue(rows),
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
    readonly: Boolean(config.readonly),
    create_fields: config.createFields || [],
    update_fields: config.updateFields || [],
  };
}

async function listRegistrationIps(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const values: unknown[] = [];
  const where: string[] = ["u.last_ip IS NOT NULL", "u.last_ip <> ''"];
  const having: string[] = [];

  if (search) {
    where.push('(u.last_ip LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status === 'limit-risk') {
    having.push('accounts_count >= 10');
  } else if (status === 'banned') {
    having.push('active_bans > 0');
  } else if (status === 'blacklisted') {
    having.push('active_blacklists > 0');
  } else if (status === 'clear') {
    having.push('active_bans = 0 AND active_blacklists = 0');
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const havingSql = having.length > 0 ? `HAVING ${having.join(' AND ')}` : '';
  const groupedSql = `
    FROM users u
    LEFT JOIN banned_ips b
      ON b.ip COLLATE utf8mb4_unicode_ci = u.last_ip
      AND (b.expire_at IS NULL OR b.expire_at > NOW())
    LEFT JOIN ip_blacklist bl ON bl.ip_address COLLATE utf8mb4_unicode_ci = u.last_ip
    ${whereSql}
    GROUP BY u.last_ip
    ${havingSql}
  `;

  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        MIN(u.id) AS id,
        u.last_ip AS ip,
        COUNT(*) AS accounts_count,
        SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN u.status IN ('locked', 'banned', 'suspended') THEN 1 ELSE 0 END) AS locked_count,
        COUNT(DISTINCT b.id) AS active_bans,
        COUNT(DISTINCT bl.id) AS active_blacklists,
        CASE WHEN COUNT(DISTINCT b.id) > 0 THEN 'banned' ELSE 'clear' END AS banned_state,
        CASE WHEN COUNT(DISTINCT bl.id) > 0 THEN 'blacklisted' ELSE 'clear' END AS blacklisted_state,
        MIN(u.created_at) AS first_seen,
        MAX(COALESCE(u.last_activity, u.updated_at, u.created_at)) AS last_seen,
        SUBSTRING_INDEX(GROUP_CONCAT(CONCAT(u.username, '#', u.id) ORDER BY u.updated_at DESC SEPARATOR ', '), ', ', 8) AS sample_users
      ${groupedSql}
      ORDER BY accounts_count DESC, last_seen DESC
      LIMIT ? OFFSET ?
    `, ...values, perPage, skip),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(`
      SELECT COUNT(*) AS total
      FROM (
        SELECT
          u.last_ip,
          COUNT(*) AS accounts_count,
          COUNT(DISTINCT b.id) AS active_bans,
          COUNT(DISTINCT bl.id) AS active_blacklists
        ${groupedSql}
      ) grouped_ips
    `, ...values),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    success: true,
    title: config.title,
    data: normalizeValue(rows.map((row) => ({
      ...row,
      id: Number(row.id || 0),
      accounts_count: Number(row.accounts_count || 0),
      active_count: Number(row.active_count || 0),
      locked_count: Number(row.locked_count || 0),
      active_bans: Number(row.active_bans || 0),
      active_blacklists: Number(row.active_blacklists || 0),
    }))),
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
    readonly: true,
    create_fields: [],
    update_fields: [],
  };
}

async function listRawTable(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const table = await getActualRawTable(config);
  const hasFindJobPinColumn = config.table === 'find_jobs' ? await ensureFindJobPinColumn(table as 'find_job_jobs' | 'find_jobs') : false;
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search && config.searchFields.length > 0) {
    conditions.push(`(${config.searchFields.map((field) => `\`${field}\` LIKE ?`).join(' OR ')})`);
    values.push(...config.searchFields.map(() => `%${search}%`));
  }

  if (status && config.statusField) {
    conditions.push(`\`${config.statusField}\` = ?`);
    values.push(status);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderSql = getRawOrderSql(config, table, hasFindJobPinColumn);

  try {
    const [rows, countRows] = await Promise.all([
      db.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM \`${table}\` ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
        ...values,
        perPage,
        skip
      ),
      db.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) as total FROM \`${table}\` ${whereSql}`,
        ...values
      ),
    ]);

    const total = Number(countRows[0]?.total || 0);
    return {
      success: true,
      title: config.title,
      data: normalizeValue(rows),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      },
      readonly: Boolean(config.readonly),
      create_fields: config.createFields || [],
      update_fields: config.updateFields || [],
    };
  } catch {
    return {
      success: true,
      title: config.title,
      data: [],
      pagination: {
        page,
        per_page: perPage,
        total: 0,
        total_pages: 1,
      },
      readonly: Boolean(config.readonly),
      create_fields: config.createFields || [],
      update_fields: config.updateFields || [],
      warning: `Bảng ${table} chưa tồn tại hoặc chưa migrate`,
    };
  }
}

export async function createAdminResource(resource: string, input: Record<string, unknown>, adminId: number, req: NextRequest) {
  const config = getConfig(resource);
  if (config.readonly) {
    throw new Error('Resource chỉ đọc');
  }

  const data = sanitizeData(input, config.createFields);
  if (Object.keys(data).length === 0) {
    throw new Error('Không có dữ liệu tạo mới hợp lệ');
  }

  if (resource === 'users' && typeof data.password === 'string') {
    const bcrypt = await import('bcryptjs');
    data.password = await bcrypt.hash(data.password, 10);
  }

  let created: unknown;
  if (config.table) {
    created = await insertRawTable(config, data);
  } else {
    const delegate = getDelegate(config);
    created = await delegate.create({ data });
  }

  if (resource === 'settings') {
    invalidateLegacySettingsCache();
  }

  await logAdminAction({ adminId, action: `create ${resource}`, target: JSON.stringify(data), req });
  return { success: true, data: normalizeValue(created) };
}

export async function updateAdminResource(resource: string, id: number, input: Record<string, unknown>, adminId: number, req: NextRequest) {
  const config = getConfig(resource);
  if (config.readonly) {
    throw new Error('Resource chỉ đọc');
  }

  const data = sanitizeData(input, config.updateFields);
  if (Object.keys(data).length === 0) {
    throw new Error('Không có dữ liệu cập nhật hợp lệ');
  }

  let updated: unknown;
  if (config.table) {
    updated = await updateRawTable(config, id, data);
  } else {
    const delegate = getDelegate(config);
    updated = await delegate.update({ where: { id }, data });
  }

  if (resource === 'settings') {
    invalidateLegacySettingsCache();
  }

  await logAdminAction({ adminId, action: `update ${resource}`, target: `#${id}`, req });
  return { success: true, data: normalizeValue(updated) };
}

export async function deleteAdminResource(resource: string, id: number, adminId: number, req: NextRequest) {
  const config = getConfig(resource);
  if (config.readonly) {
    throw new Error('Resource chỉ đọc');
  }

  if (resource === 'users') {
    const updated = await db.users.update({
      where: { id },
      data: { status: 'banned', lock_reason: 'Admin mass/delete action', locked_at: new Date() },
    });
    await logAdminAction({ adminId, action: 'ban user', target: `#${id}`, req });
    return { success: true, data: normalizeValue(updated) };
  }

  if (resource === 'smm-services') {
    const updated = await db.smm_services_cache.update({
      where: { id },
      data: { is_deleted: true, status: 'inactive' },
    });
    await logAdminAction({ adminId, action: 'soft delete smm service', target: `#${id}`, req });
    return { success: true, data: normalizeValue(updated) };
  }

  if (config.table) {
    await deleteRawTable(config, id);
  } else {
    const delegate = getDelegate(config);
    await delegate.delete({ where: { id } });
  }

  if (resource === 'settings') {
    invalidateLegacySettingsCache();
  }

  await logAdminAction({ adminId, action: `delete ${resource}`, target: `#${id}`, req });
  return { success: true };
}

export async function runAdminAction(resource: string, input: Record<string, unknown>, adminId: number, req: NextRequest) {
  const action = String(input.action || '').trim();
  const ids = Array.isArray(input.ids)
    ? input.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  if (resource === 'registration-ips') {
    return runRegistrationIpAction(action, input, ids, adminId, req);
  }

  if (resource === 'deposits' && (action === 'approve' || action === 'reject')) {
    const id = Number(input.id || ids[0] || 0);
    if (!id) throw new Error('Thiếu ID giao dịch');
    const result = await processDeposit(id, action === 'approve', adminId, req);
    return { success: true, data: normalizeValue(result) };
  }

  if (resource === 'card-orders' && action === 'refund') {
    const id = Number(input.id || ids[0] || 0);
    if (!id) throw new Error('Thiếu ID đơn thẻ');
    const result = await refundCardOrder(id, adminId, req);
    return { success: true, data: normalizeValue(result) };
  }

  const moderationAction = action.replace(/^bulk-/, '');
  if (
    (resource === 'forum-threads' || resource === 'forum-posts' || resource === 'find-jobs') &&
    (moderationAction === 'approve' || moderationAction === 'reject')
  ) {
    const directId = Number(input.id || 0);
    const targetIds = directId ? [directId] : ids;
    if (targetIds.length === 0) {
      throw new Error('Chọn ít nhất một bài cần xử lý');
    }

    const approved = moderationAction === 'approve';
    const results = [];
    for (const targetId of targetIds) {
      if (resource === 'forum-threads') {
        results.push(await moderateForumThread(targetId, approved, adminId, req));
      } else if (resource === 'forum-posts') {
        results.push(await moderateForumPost(targetId, approved, adminId, req));
      } else {
        results.push(await moderateFindJob(targetId, approved, adminId, req));
      }
    }

    return { success: true, affected: results.length, data: normalizeValue(results) };
  }

  if ((resource === 'forum-threads' || resource === 'find-jobs') && (action === 'pin' || action === 'unpin')) {
    const id = Number(input.id || ids[0] || 0);
    if (!id) throw new Error('Thiếu ID bài viết cần ghim');
    const pinned = action === 'pin';

    if (resource === 'forum-threads') {
      await db.$executeRawUnsafe(
        'UPDATE `forum_threads` SET `is_pinned` = ? WHERE id = ?',
        pinned ? 1 : 0,
        id
      );
      const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
        'SELECT * FROM `forum_threads` WHERE id = ? LIMIT 1',
        id
      );
      await logAdminAction({ adminId, action: pinned ? 'pin forum thread' : 'unpin forum thread', target: `#${id}`, req });
      return { success: true, data: normalizeValue(rows[0] || { id, is_pinned: pinned }) };
    }

    const table = await resolveFindJobTable();
    const hasPinColumn = await ensureFindJobPinColumn(table);
    if (!hasPinColumn) {
      throw new Error('Database Find Job chưa có cột is_pinned và không thể tự tạo cột này');
    }
    await db.$executeRawUnsafe(`UPDATE \`${table}\` SET \`is_pinned\` = ? WHERE id = ?`, pinned ? 1 : 0, id);
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, id);
    await logAdminAction({ adminId, action: pinned ? 'pin find job' : 'unpin find job', target: `#${id}`, req });
    return { success: true, data: normalizeValue(rows[0] || { id, is_pinned: pinned }) };
  }

  if (action === 'bulk-delete' && ids.length > 0) {
    for (const id of ids) {
      await deleteAdminResource(resource, id, adminId, req);
    }
    return { success: true, affected: ids.length };
  }

  if (action === 'bulk-update' && ids.length > 0) {
    const patch = typeof input.patch === 'object' && input.patch ? input.patch as Record<string, unknown> : {};
    for (const id of ids) {
      await updateAdminResource(resource, id, patch, adminId, req);
    }
    return { success: true, affected: ids.length };
  }

  if (action === 'sync') {
    if (resource === 'resources' || resource === 'resource-categories') {
      const { syncMmoResourcesFromProviders } = await import('@/lib/mmo-provider');
      const result = await syncMmoResourcesFromProviders();
      await logAdminAction({
        adminId,
        action: 'sync mmo resources',
        target: `${result.providers} provider / ${result.categories} categories / ${result.products} products`,
        req,
      });
      return { success: true, data: normalizeValue(result) };
    }

    if (resource === 'smm-services') {
      const { listSmmServices } = await import('@/lib/smm-provider');
      const services = await listSmmServices(true);
      await logAdminAction({ adminId, action: 'sync smm services', target: `${services.length} services`, req });
      return { success: true, count: services.length };
    }

    if (resource === 'providers') {
      const providers = await db.api_providers.updateMany({
        data: { last_sync: new Date(), health_status: 'online' },
      });
      return { success: true, affected: providers.count };
    }
  }

  if (action === 'check-new-deposits') {
    const sepay = await reconcilePendingSePayDeposits({ limit: 20 }).catch((error) => ({
      checked: 0,
      processed: 0,
      already_processed: 0,
      failed: 0,
      still_pending: 0,
      missing_remote: 0,
      skipped: false,
      reason: '',
      errors: [error instanceof Error ? error.message : 'SePay reconcile failed'],
    }));
    const pending = await db.transactions.count({ where: { type: 'deposit', status: 'pending' } });
    return { success: true, pending, sepay };
  }

  throw new Error('Action chưa được hỗ trợ');
}

async function notifyModerationUser(input: {
  userId: number;
  adminId: number;
  type: string;
  message: string;
  link: string;
}) {
  if (!input.userId) return;
  await db.$executeRawUnsafe(
    `
      INSERT INTO notifications (user_id, from_user_id, type, message, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, NOW())
    `,
    input.userId,
    input.adminId,
    input.type,
    input.message,
    input.link
  ).catch(() => undefined);
}

async function moderateForumThread(id: number, approved: boolean, adminId: number, req: NextRequest) {
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    'SELECT id, user_id, title, status FROM `forum_threads` WHERE id = ? LIMIT 1',
    id
  );
  const thread = rows[0];
  if (!thread) throw new Error(`Không tìm thấy thread #${id}`);

  const firstPostRows = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>(
    'SELECT id FROM `forum_posts` WHERE thread_id = ? AND is_first_post = 1 ORDER BY id ASC LIMIT 1',
    id
  );
  const firstPostId = Number(firstPostRows[0]?.id || 0);
  const nextStatus = approved ? 'active' : 'rejected';
  const wasActive = String(thread.status || '').toLowerCase() === 'active';

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE forum_threads
        SET status = ?, is_deleted = 0, updated_at = NOW(), last_post_id = COALESCE(?, last_post_id)
        WHERE id = ?
      `,
      nextStatus,
      firstPostId || null,
      id
    );
    await tx.$executeRawUnsafe(
      `
        UPDATE forum_posts
        SET status = ?, is_deleted = 0, updated_at = NOW()
        WHERE thread_id = ? AND is_first_post = 1
      `,
      nextStatus,
      id
    );

    if (approved && !wasActive) {
      await tx.$executeRawUnsafe(
        'UPDATE users SET post_count = COALESCE(post_count, 0) + 1, last_activity = NOW() WHERE id = ?',
        Number(thread.user_id || 0)
      ).catch(() => undefined);
    }
  });

  await notifyModerationUser({
    userId: Number(thread.user_id || 0),
    adminId,
    type: approved ? 'forum_thread_approved' : 'forum_thread_rejected',
    message: approved
      ? `Thread của bạn đã được duyệt: ${String(thread.title || `#${id}`)}`
      : `Thread của bạn đã bị từ chối: ${String(thread.title || `#${id}`)}`,
    link: approved ? `/user/forum/thread/${id}` : '/user/forum/my-threads',
  });
  await logAdminAction({ adminId, action: approved ? 'approve forum thread' : 'reject forum thread', target: `#${id}`, req });

  const updated = await db.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT * FROM `forum_threads` WHERE id = ? LIMIT 1', id);
  return updated[0] || { id, status: nextStatus };
}

async function moderateForumPost(id: number, approved: boolean, adminId: number, req: NextRequest) {
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT p.id, p.thread_id, p.user_id, p.is_first_post, p.status, t.title, t.user_id AS thread_owner_id
      FROM forum_posts p
      LEFT JOIN forum_threads t ON t.id = p.thread_id
      WHERE p.id = ?
      LIMIT 1
    `,
    id
  );
  const post = rows[0];
  if (!post) throw new Error(`Không tìm thấy post #${id}`);

  const threadId = Number(post.thread_id || 0);
  const postUserId = Number(post.user_id || 0);
  const threadOwnerId = Number(post.thread_owner_id || 0);
  const isFirstPost = Number(post.is_first_post || 0) === 1;
  const wasActive = String(post.status || '').toLowerCase() === 'active';
  const nextStatus = approved ? 'active' : 'rejected';

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'UPDATE forum_posts SET status = ?, is_deleted = 0, updated_at = NOW() WHERE id = ?',
      nextStatus,
      id
    );

    if (isFirstPost) {
      await tx.$executeRawUnsafe(
        'UPDATE forum_threads SET status = ?, is_deleted = 0, updated_at = NOW(), last_post_id = ? WHERE id = ?',
        nextStatus,
        id,
        threadId
      );
    } else if (approved) {
      await tx.$executeRawUnsafe(
        'UPDATE forum_threads SET updated_at = NOW(), last_post_id = ? WHERE id = ?',
        id,
        threadId
      );
    }

    if (approved && !wasActive) {
      await tx.$executeRawUnsafe(
        'UPDATE users SET post_count = COALESCE(post_count, 0) + 1, last_activity = NOW() WHERE id = ?',
        postUserId
      ).catch(() => undefined);
    }
  });

  await notifyModerationUser({
    userId: postUserId,
    adminId,
    type: approved ? 'forum_post_approved' : 'forum_post_rejected',
    message: approved
      ? `Bài viết của bạn đã được duyệt trong thread: ${String(post.title || `#${threadId}`)}`
      : `Bài viết của bạn đã bị từ chối trong thread: ${String(post.title || `#${threadId}`)}`,
    link: approved ? `/user/forum/thread/${threadId}#post-${id}` : '/user/forum/posts',
  });

  if (approved && !isFirstPost && threadOwnerId && threadOwnerId !== postUserId) {
    await notifyModerationUser({
      userId: threadOwnerId,
      adminId,
      type: 'reply',
      message: `Có phản hồi mới đã được duyệt trong chủ đề của bạn: ${String(post.title || `#${threadId}`)}`,
      link: `/user/forum/thread/${threadId}#post-${id}`,
    });
  }

  await logAdminAction({ adminId, action: approved ? 'approve forum post' : 'reject forum post', target: `#${id}`, req });
  const updated = await db.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT * FROM `forum_posts` WHERE id = ? LIMIT 1', id);
  return updated[0] || { id, status: nextStatus };
}

async function moderateFindJob(id: number, approved: boolean, adminId: number, req: NextRequest) {
  const table = await resolveFindJobTable();
  await ensureFindJobPinColumn(table);
  const columns = await getRawTableColumns(table);
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, id);
  const job = rows[0];
  if (!job) throw new Error(`Không tìm thấy Find Job #${id}`);

  const ownerId = Number(job.posted_by || job.user_id || 0);
  const patch: Record<string, unknown> = {
    status: approved ? 'open' : 'rejected',
    approval_status: approved ? 'approved' : 'rejected',
    updated_at: new Date(),
    approved_at: approved ? new Date() : null,
    reviewed_at: new Date(),
    reviewed_by: adminId,
  };
  const fields = Object.keys(patch).filter((field) => columns.has(field));
  if (!fields.includes('status')) fields.unshift('status');

  await db.$executeRawUnsafe(
    `UPDATE \`${table}\` SET ${fields.map((field) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
    ...fields.map((field) => patch[field]),
    id
  );

  await notifyModerationUser({
    userId: ownerId,
    adminId,
    type: approved ? 'find_job_approved' : 'find_job_rejected',
    message: approved
      ? `Tin Find Job của bạn đã được duyệt: ${String(job.title || `#${id}`)}`
      : `Tin Find Job của bạn đã bị từ chối: ${String(job.title || `#${id}`)}`,
    link: approved ? `/user/find-job/${id}` : '/user/find-job/my-jobs',
  });
  await logAdminAction({ adminId, action: approved ? 'approve find job' : 'reject find job', target: `#${id}`, req });

  const updated = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, id);
  return updated[0] || { id, status: approved ? 'open' : 'rejected' };
}

async function runRegistrationIpAction(
  action: string,
  input: Record<string, unknown>,
  ids: number[],
  adminId: number,
  req: NextRequest
) {
  const normalizedAction = action.replace(/^bulk-/, '');
  const targetIps = await resolveRegistrationIpTargets(input, ids);
  if (targetIps.length === 0) {
    throw new Error('Không tìm thấy IP hợp lệ để xử lý');
  }

  const reason = String(input.reason || 'Admin xử lý IP đa tài khoản').trim();
  let affected = 0;

  for (const ip of targetIps) {
    if (normalizedAction === 'block-ip') {
      const updated = await db.$executeRawUnsafe(`
        UPDATE banned_ips
        SET reason = ?, banned_by = 'admin', user_id = ?, expire_at = NULL, created_at = NOW()
        WHERE ip = ?
      `, reason, adminId, ip);

      if (Number(updated || 0) === 0) {
        await db.$executeRawUnsafe(`
          INSERT INTO banned_ips (ip, reason, banned_by, user_id, expire_at)
          VALUES (?, ?, 'admin', ?, NULL)
        `, ip, reason, adminId);
      }
      affected += 1;
      continue;
    }

    if (normalizedAction === 'unblock-ip') {
      const deletedBans = await db.$executeRawUnsafe('DELETE FROM banned_ips WHERE ip = ?', ip);
      const deletedBlacklist = await db.$executeRawUnsafe('DELETE FROM ip_blacklist WHERE ip_address = ?', ip);
      affected += Number(deletedBans || 0) + Number(deletedBlacklist || 0);
      continue;
    }

    if (normalizedAction === 'lock-users-by-ip') {
      const result = await db.users.updateMany({
        where: {
          last_ip: ip,
          role: { not: 'admin' },
        },
        data: {
          status: 'banned',
          lock_reason: reason,
          locked_at: new Date(),
        },
      });
      affected += result.count;
      continue;
    }

    if (normalizedAction === 'unlock-users-by-ip') {
      const result = await db.users.updateMany({
        where: {
          last_ip: ip,
          role: { not: 'admin' },
          status: { in: ['locked', 'banned', 'suspended'] },
        },
        data: {
          status: 'active',
          lock_reason: null,
          locked_at: null,
          locked_until: null,
        },
      });
      affected += result.count;
      continue;
    }

    throw new Error('Action IP chưa được hỗ trợ');
  }

  await logAdminAction({
    adminId,
    action: `registration-ip ${normalizedAction}`,
    target: targetIps.join(', '),
    req,
  });

  return { success: true, affected, ips: targetIps };
}

async function resolveRegistrationIpTargets(input: Record<string, unknown>, ids: number[]) {
  const directIps = [
    typeof input.ip === 'string' ? input.ip : '',
    ...(Array.isArray(input.ips) ? input.ips.filter((ip): ip is string => typeof ip === 'string') : []),
  ].map((ip) => ip.trim()).filter(isTrackableIp);

  const id = Number(input.id || 0);
  const userIds = Array.from(new Set([id, ...ids].filter((item) => Number.isFinite(item) && item > 0)));

  if (userIds.length === 0) {
    return Array.from(new Set(directIps));
  }

  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await db.$queryRawUnsafe<Array<{ last_ip: string | null }>>(
    `SELECT DISTINCT last_ip FROM users WHERE id IN (${placeholders})`,
    ...userIds
  );

  return Array.from(new Set([
    ...directIps,
    ...rows.map((row) => row.last_ip || '').filter(isTrackableIp),
  ]));
}

async function processDeposit(id: number, approve: boolean, adminId: number, req: NextRequest) {
  return db.$transaction(async (tx) => {
    const deposit = await tx.transactions.findUnique({ where: { id } });
    if (!deposit || deposit.type !== 'deposit') {
      throw new Error('Không tìm thấy giao dịch nạp');
    }

    if (deposit.status === 'success' || deposit.status === 'failed') {
      return deposit;
    }

    if (!approve) {
      const rejected = await tx.transactions.update({
        where: { id },
        data: { status: 'failed', content: `${deposit.content || ''} | Rejected by admin #${adminId}` },
      });
      await logAdminAction({ adminId, action: 'reject deposit', target: `#${id}`, req });
      return rejected;
    }

    const user = await tx.users.findUnique({ where: { id: deposit.user_id }, select: { balance: true } });
    if (!user) throw new Error('Không tìm thấy user');

    const nextBalance = toNumber(user.balance, 0) + toNumber(deposit.amount, 0);
    await tx.users.update({ where: { id: deposit.user_id }, data: { balance: nextBalance } });
    const updated = await tx.transactions.update({
      where: { id },
      data: { status: 'success', balance_after: nextBalance },
    });
    await logAdminAction({ adminId, action: 'approve deposit', target: `#${id}`, req });
    return updated;
  });
}

async function refundCardOrder(id: number, adminId: number, req: NextRequest) {
  return db.$transaction(async (tx) => {
    const order = await tx.card_orders.findUnique({ where: { id } });
    if (!order) throw new Error('Không tìm thấy đơn thẻ');
    if (order.status === 'refunded') return order;

    const user = await tx.users.findUnique({ where: { id: order.user_id }, select: { balance: true } });
    if (!user) throw new Error('Không tìm thấy user');
    const nextBalance = toNumber(user.balance, 0) + toNumber(order.amount, 0);
    await tx.users.update({ where: { id: order.user_id }, data: { balance: nextBalance } });
    const updated = await tx.card_orders.update({
      where: { id },
      data: { status: 'refunded', note: `Refund by admin #${adminId}` },
    });
    await tx.transactions.create({
      data: {
        user_id: order.user_id,
        amount: order.amount,
        balance_after: nextBalance,
        type: 'refund',
        status: 'success',
        content: `Hoàn tiền đơn thẻ #${id}`,
      },
    });
    await logAdminAction({ adminId, action: 'refund card order', target: `#${id}`, req });
    return updated;
  });
}

async function insertRawTable(config: ResourceConfig, data: Record<string, unknown>) {
  const table = await getActualRawTable(config);
  if (config.table === 'find_jobs') {
    await ensureFindJobPinColumn(table as 'find_job_jobs' | 'find_jobs');
  }
  const filteredData = await filterRawTableData(table, data);
  const fields = Object.keys(filteredData);
  if (fields.length === 0) {
    throw new Error('Không có field hợp lệ với bảng hiện tại');
  }
  const columns = fields.map((field) => `\`${field}\``).join(', ');
  const placeholders = fields.map(() => '?').join(', ');
  await db.$executeRawUnsafe(
    `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`,
    ...fields.map((field) => filteredData[field])
  );
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM \`${table}\` ORDER BY id DESC LIMIT 1`);
  return rows[0] || filteredData;
}

async function updateRawTable(config: ResourceConfig, id: number, data: Record<string, unknown>) {
  const table = await getActualRawTable(config);
  if (config.table === 'find_jobs') {
    await ensureFindJobPinColumn(table as 'find_job_jobs' | 'find_jobs');
  }
  const filteredData = await filterRawTableData(table, data);
  const fields = Object.keys(filteredData);
  if (fields.length === 0) {
    throw new Error('Không có field hợp lệ với bảng hiện tại');
  }
  const setSql = fields.map((field) => `\`${field}\` = ?`).join(', ');
  await db.$executeRawUnsafe(
    `UPDATE \`${table}\` SET ${setSql} WHERE id = ?`,
    ...fields.map((field) => filteredData[field]),
    id
  );
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, id);
  return rows[0] || { id, ...filteredData };
}

async function deleteRawTable(config: ResourceConfig, id: number) {
  const table = await getActualRawTable(config);
  if (config.table === 'find_jobs') {
    await ensureFindJobPinColumn(table as 'find_job_jobs' | 'find_jobs');
  }
  await db.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE id = ?`, id);
}

async function getActualRawTable(config: ResourceConfig) {
  if (config.table === 'find_jobs') {
    return resolveFindJobTable();
  }

  return config.table!;
}

function getRawOrderSql(config: ResourceConfig, table: string, hasFindJobPinColumn: boolean) {
  if (config.table === 'find_jobs') {
    const pinnedPrefix = hasFindJobPinColumn ? 'is_pinned DESC, ' : '';
    return table === 'find_job_jobs'
      ? `${pinnedPrefix}posted_at DESC, id DESC`
      : `${pinnedPrefix}updated_at DESC, id DESC`;
  }

  return config.rawOrder || 'id DESC';
}

async function getRawTableColumns(table: string) {
  const cached = rawTableColumnCache.get(table);
  if (cached) {
    return cached;
  }

  const columns = await db.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM \`${table}\``);
  const columnSet = new Set(columns.map((column) => column.Field));
  rawTableColumnCache.set(table, columnSet);
  return columnSet;
}

async function filterRawTableData(table: string, data: Record<string, unknown>) {
  const columns = await getRawTableColumns(table);
  return Object.fromEntries(Object.entries(data).filter(([field]) => columns.has(field)));
}
