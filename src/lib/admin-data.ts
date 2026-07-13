import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/admin-auth';
import { getUtcDatabaseDateTime, getVietnamDatabaseDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { ensureFindJobPinColumn, resolveFindJobTable } from '@/lib/find-job';
import { getGameMarketRejectedLikeStatus } from '@/lib/game-market-schema';
import { isTrackableIp } from '@/lib/ip-security';
import { decryptLegacyData } from '@/lib/legacy-crypto';
import { getLegacySettingsMap, getVatPercent, invalidateLegacySettingsCache } from '@/lib/legacy-settings';
import { sendSecurityAlertEmail } from '@/lib/security-alert-email';
import { ensureMetaSupportOrdersTable, normalizeMetaSupportStatus } from '@/lib/meta-support';
import { approveDepositById } from '@/lib/deposit-processing';
import { ensureGameApiKeyForUser } from '@/lib/game-integration-api';
import { reconcilePendingSePayDeposits } from '@/lib/sepay-deposit-sync';
import { normalizeSmmOrderStatus } from '@/lib/smm-status';
import { clearSmmServicesCache } from '@/lib/smm-provider';
import { toNumber } from '@/lib/utils';
import { tableExists } from '@/lib/legacy-modules';
import { ensureVibeCodeTables } from '@/lib/vibe-code';
import { ensurePressServiceTables } from '@/lib/press-service';
import { ensureWebServiceTables } from '@/lib/web-service';
import {
  ensureTikTokChannelTables,
  invalidateKenhGiaReSettingsCache,
  listAdminTikTokChannelOrders,
  listKenhGiaReSettings,
  syncKenhGiaReProducts,
  updateTikTokChannelProductAutoPrice,
} from '@/lib/tiktok-channel';
import { buildForumModerationText, containsForumGamblingContent, forumVietnamTimestampSql } from '@/lib/forum';
import { assertUserEmailAvailable, normalizeUserEmail } from '@/lib/user-email-guard';
import { isOwnerRole } from '@/lib/admin-permissions';

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
      game_balance: true,
      rank: true,
      fa_enabled: true,
      telegram_2fa_enabled: true,
      fa_type: true,
      last_ip: true,
      last_login: true,
      lock_reason: true,
      created_at: true,
    },
    createFields: ['username', 'email', 'password', 'fullname', 'role', 'status', 'balance', 'game_balance', 'rank'],
    updateFields: ['fullname', 'email', 'role', 'status', 'balance', 'game_balance', 'rank', 'fa_enabled', 'telegram_2fa_enabled', 'fa_type', 'lock_reason', 'locked_until', 'is_blue_tick'],
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
      wallet_type: true,
      type: true,
      status: true,
      created_at: true,
    },
    updateFields: ['status', 'content', 'amount', 'wallet_type'],
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
    updateFields: ['name', 'custom_price', 'status', 'is_deleted', 'is_auto_margin', 'margin_percent', 'name_color', 'description', 'server_info'],
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
    searchFields: ['name', 'description', 'badge', 'status', 'type'],
    statusField: 'status',
    rawOrder: 'updated_at DESC, id DESC',
    createFields: ['category_id', 'api_provider_id', 'api_service_id', 'name', 'slug', 'badge', 'price', 'cost', 'type', 'description', 'input_label', 'input_placeholder', 'buyer_label', 'buyer_placeholder', 'status'],
    updateFields: ['category_id', 'api_provider_id', 'api_service_id', 'name', 'slug', 'badge', 'price', 'cost', 'type', 'description', 'input_label', 'input_placeholder', 'buyer_label', 'buyer_placeholder', 'status', 'is_deleted'],
  },
  'automxh-orders': {
    table: 'automxh_orders',
    title: 'Auto MXH orders',
    searchFields: ['api_order_id', 'link', 'buyer_info', 'status'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'reason', 'is_refunded', 'refund_amount', 'price', 'cost_price', 'buyer_info', 'api_order_id', 'api_response', 'api_status_log', 'perfection_content', 'perfection_image', 'avatar_path', 'additional_files', 'confirm_1', 'confirm_2', 'is_exported'],
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
  'meta-support-orders': {
    table: 'meta_support_orders',
    title: 'Auto kích nút Meta orders',
    searchFields: ['contact', 'gmail', 'note', 'admin_note', 'status'],
    statusField: 'status',
    rawOrder: 'updated_at DESC, id DESC',
    updateFields: ['contact', 'gmail', 'quantity', 'price', 'note', 'admin_note', 'status'],
  },
  'vibe-code-packages': {
    table: 'vibe_code_packages',
    title: 'Vibe Code packages',
    searchFields: ['provider', 'package_key', 'title', 'description', 'status'],
    statusField: 'status',
    rawOrder: 'provider ASC, display_order ASC, id ASC',
    createFields: ['provider', 'package_key', 'title', 'description', 'unit_label', 'unit_amount', 'source_price_vnd', 'sale_price_vnd', 'display_order', 'status'],
    updateFields: ['provider', 'package_key', 'title', 'description', 'unit_label', 'unit_amount', 'source_price_vnd', 'sale_price_vnd', 'display_order', 'status'],
  },
  'vibe-code-orders': {
    table: 'vibe_code_orders',
    title: 'Vibe Code orders',
    searchFields: ['order_code', 'provider', 'package_key', 'package_title', 'status', 'admin_note'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'admin_note', 'sale_price_vnd', 'source_price_vnd'],
  },
  'web-service-packages': {
    table: 'web_service_packages',
    title: 'Web service packages',
    searchFields: ['category', 'package_key', 'title', 'description', 'status'],
    statusField: 'status',
    rawOrder: "FIELD(category, 'web_con', 'build_web'), display_order ASC, id ASC",
    createFields: ['category', 'package_key', 'title', 'description', 'price_min_vnd', 'price_max_vnd', 'display_order', 'status'],
    updateFields: ['category', 'package_key', 'title', 'description', 'price_min_vnd', 'price_max_vnd', 'display_order', 'status'],
  },
  'web-service-orders': {
    table: 'web_service_orders',
    title: 'Web service orders',
    searchFields: ['order_code', 'category', 'package_key', 'package_title', 'contact', 'desired_domain', 'requirement', 'status', 'admin_note'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'admin_note', 'quoted_price_vnd', 'contact', 'desired_domain', 'requirement', 'price_min_vnd', 'price_max_vnd'],
  },
  'press-publications': {
    table: 'press_publications',
    title: 'Bảng giá báo chí',
    searchFields: ['publication_key', 'name', 'url', 'note', 'status'],
    statusField: 'status',
    rawOrder: 'display_order ASC, id ASC',
    createFields: ['publication_key', 'name', 'url', 'price_vnd', 'note', 'display_order', 'status'],
    updateFields: ['publication_key', 'name', 'url', 'price_vnd', 'note', 'display_order', 'status'],
  },
  'press-orders': {
    table: 'press_orders',
    title: 'Đơn lên báo',
    searchFields: ['order_code', 'publication_name', 'title', 'contact', 'status', 'admin_note'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'admin_note', 'publication_name', 'title', 'contact', 'note', 'docx_path', 'price_vnd'],
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
    rawOrder: 'created_at DESC, id DESC',
    createFields: ['forum_id', 'user_id', 'title', 'slug', 'status', 'is_pinned', 'is_locked'],
    updateFields: ['forum_id', 'user_id', 'title', 'slug', 'status', 'is_pinned', 'is_locked', 'is_deleted'],
  },
  'forum-posts': {
    table: 'forum_posts',
    title: 'Forum posts',
    searchFields: ['content', 'status'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
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
    title: 'Đơn trao đổi game',
    searchFields: ['status', 'delivered_data', 'review'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    createFields: ['id', 'buyer_id', 'seller_id', 'item_id', 'stock_id', 'amount', 'delivered_data', 'status'],
    updateFields: ['buyer_id', 'seller_id', 'item_id', 'stock_id', 'amount', 'delivered_data', 'status', 'rating', 'review'],
  },
  'game-items': {
    table: 'game_market_items',
    title: 'Bài trao đổi game',
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
    createFields: ['user_id', 'posted_by', 'title', 'slug', 'description', 'category', 'budget_min', 'price_min', 'budget_max', 'price_max', 'status', 'approval_status', 'is_pinned'],
    updateFields: ['title', 'slug', 'description', 'category', 'budget_min', 'price_min', 'budget_max', 'price_max', 'status', 'approval_status', 'is_pinned'],
  },
  'vps-gpu-offer-costs': {
    table: 'vps_gpu_offer_costs',
    title: 'VPS GPU provider cost snapshots',
    searchFields: ['offer_id', 'machine_id', 'host_id', 'gpu_name', 'location', 'cost_source'],
    rawOrder: 'last_seen_at DESC, id DESC',
    readonly: true,
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
  'owner-security-events': {
    table: 'owner_security_events',
    title: 'Owner security events',
    searchFields: ['username', 'email', 'event_type', 'verdict', 'reason', 'ip_address', 'user_agent', 'device_hash', 'request_path'],
    rawOrder: 'created_at DESC, id DESC',
    readonly: true,
  },
  'owner-trusted-devices': {
    table: 'owner_trusted_devices',
    title: 'Owner trusted devices',
    searchFields: ['label', 'device_hash', 'first_ip', 'last_ip', 'trust_level'],
    rawOrder: 'last_seen_at DESC, id DESC',
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
  'kenh-tiktok-settings': {
    table: 'settings',
    title: 'Cấu hình Kênh Giá Rẻ',
    searchFields: ['setting_key', 'setting_value'],
    rawOrder: 'id ASC',
    createFields: ['setting_key', 'setting_value'],
    updateFields: ['setting_value'],
  },
  'tiktok-channel-products': {
    table: 'tiktok_channel_products',
    title: 'Kênh TikTok',
    searchFields: ['provider_product_id', 'title', 'niche', 'masked_username', 'status'],
    statusField: 'status',
    rawOrder: 'synced_at DESC, id DESC',
    updateFields: ['title', 'description', 'niche', 'sale_price_vnd', 'margin_percent', 'is_auto_price', 'status'],
  },
  'tiktok-channel-orders': {
    table: 'tiktok_channel_orders',
    title: 'Đơn Kênh TikTok',
    searchFields: ['order_code', 'provider_product_id', 'product_title', 'status', 'admin_note'],
    statusField: 'status',
    rawOrder: 'created_at DESC, id DESC',
    updateFields: ['status', 'admin_note', 'sale_price_vnd'],
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

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch {
    // Fallback below keeps legacy non-JSON text usable.
  }

  return [trimmed];
}

const nullableDateFieldPatterns = [
  /(^|_)(date|dates)$/i,
  /_at$/i,
  /_until$/i,
  /_expiry$/i,
  /_expires$/i,
  /^ngay_/i,
];

const nullableBooleanFieldPatterns = [
  /^is_/i,
  /^show_/i,
  /^allow_/i,
  /^requires_/i,
  /_enabled$/i,
];

function isNullableDateField(field: string) {
  return nullableDateFieldPatterns.some((pattern) => pattern.test(field));
}

function isNullableBooleanField(field: string) {
  return nullableBooleanFieldPatterns.some((pattern) => pattern.test(field));
}

function sanitizeData(input: Record<string, unknown>, allowedFields: string[] = []) {
  const output: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      output[field] = field === 'setting_value' ? String(input[field] ?? '') : coerceInput(field, input[field]);
    }
  }
  return output;
}

type PrismaFieldMeta = {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
};

function getPrismaModelFields(modelName: string) {
  const model = Prisma.dmmf.datamodel.models.find((item) => item.name === modelName);
  if (!model) {
    return new Map<string, PrismaFieldMeta>();
  }

  return new Map(
    model.fields.map((field) => [
      field.name,
      {
        name: field.name,
        type: String(field.type),
        isRequired: Boolean(field.isRequired),
        isList: Boolean(field.isList),
      },
    ])
  );
}

const prismaModelFieldsCache = new Map<string, Map<string, PrismaFieldMeta>>();

function getCachedPrismaModelFields(modelName: string) {
  let fields = prismaModelFieldsCache.get(modelName);
  if (!fields) {
    fields = getPrismaModelFields(modelName);
    prismaModelFieldsCache.set(modelName, fields);
  }
  return fields;
}

function parseBooleanInput(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on', 'bật', 'bat'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', 'tắt', 'tat'].includes(normalized)) return false;
  return fallback;
}

function coercePrismaField(field: PrismaFieldMeta, value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const type = field.type;
  const isEmptyString = typeof value === 'string' && value.trim() === '';

  if (isEmptyString) {
    if (type === 'String') return '';
    if (!field.isRequired) return null;
    if (['Int', 'BigInt', 'Float', 'Decimal'].includes(type)) return 0;
    if (type === 'Boolean') return false;
    return '';
  }

  if (type === 'String') {
    return String(value);
  }

  if (type === 'Int') {
    return Math.trunc(toNumber(value, 0));
  }

  if (type === 'BigInt') {
    return BigInt(Math.trunc(toNumber(value, 0)));
  }

  if (type === 'Float' || type === 'Decimal') {
    return toNumber(value, 0);
  }

  if (type === 'Boolean') {
    return parseBooleanInput(value, false);
  }

  if (type === 'DateTime') {
    if (value instanceof Date) return value;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return typeof value === 'string' ? value.trim() : value;
}

function normalizePrismaPayload(config: ResourceConfig, data: Record<string, unknown>) {
  if (!config.delegate) {
    return data;
  }

  const fields = getCachedPrismaModelFields(config.delegate);
  if (fields.size === 0) {
    return data;
  }

  const output: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(data)) {
    const meta = fields.get(field);
    output[field] = meta ? coercePrismaField(meta, value) : value;
  }
  return output;
}

async function getRawColumnTypes(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ Field: string; Type: string }>>(`SHOW COLUMNS FROM \`${table}\``);
  return new Map(rows.map((column) => [column.Field, String(column.Type || '').toLowerCase()]));
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

const MAX_SMM_DECIMAL_15_4 = 99999999999.9999;

function buildSmmSafeMarginPriceSql(rateExpression = '`rate`') {
  return `LEAST(${MAX_SMM_DECIMAL_15_4}, ROUND(COALESCE(${rateExpression}, 0) * (1 + (? / 100)), 4))`;
}

function normalizeSmmServicePatch(input: Record<string, unknown>, currentServerInfo?: unknown) {
  if (!Object.prototype.hasOwnProperty.call(input, 'name_color')) {
    return input;
  }

  const { name_color: nameColorInput, ...rest } = input;
  const serverInfo = parseJsonObject(rest.server_info ?? currentServerInfo);
  const nameColor = normalizeHexColor(nameColorInput);

  if (nameColor) {
    serverInfo.name_color = nameColor;
  } else {
    delete serverInfo.name_color;
  }

  return {
    ...rest,
    server_info: Object.keys(serverInfo).length > 0 ? JSON.stringify(serverInfo) : null,
  };
}

function normalizeOptionalNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = toNumber(value, fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOptionalInteger(value: unknown, fallback = 0) {
  return Math.trunc(normalizeOptionalNumber(value, fallback));
}

function normalizeOptionalBooleanNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return 1;
  if (['false', '0', 'no', 'off'].includes(normalized)) return 0;
  return fallback;
}

function normalizeActiveInactiveStatus(value: unknown, fallback: 'active' | 'inactive' = 'active') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['active', 'enabled', 'enable', 'open', '1', 'true', 'yes', 'on', 'dang bat', 'bat'].includes(normalized)) {
    return 'active';
  }

  if (['inactive', 'disabled', 'disable', 'closed', '0', 'false', 'no', 'off', 'dang tat', 'tat'].includes(normalized)) {
    return 'inactive';
  }

  return fallback;
}

function normalizeAutoMxhVariantPatch(input: Record<string, unknown>) {
  const output = { ...input };

  if ('product_id' in output) output.product_id = normalizeOptionalInteger(output.product_id, 0);
  if ('api_provider_id' in output) output.api_provider_id = normalizeOptionalInteger(output.api_provider_id, 0);
  if ('quantity' in output) output.quantity = Math.max(1, normalizeOptionalInteger(output.quantity, 1));
  if ('price' in output) output.price = normalizeOptionalNumber(output.price, 0);
  if ('cost' in output) output.cost = normalizeOptionalNumber(output.cost, 0);
  if ('original_price' in output) output.original_price = normalizeOptionalNumber(output.original_price, 0);
  if ('allow_avatar' in output) output.allow_avatar = normalizeOptionalBooleanNumber(output.allow_avatar, 0);
  if ('allow_files' in output) output.allow_files = normalizeOptionalBooleanNumber(output.allow_files, 0);
  if ('is_deleted' in output) output.is_deleted = normalizeOptionalBooleanNumber(output.is_deleted, 0);
  if ('status' in output) output.status = normalizeActiveInactiveStatus(output.status, 'active');

  return output;
}

function normalizeAutoMxhCategoryPatch(input: Record<string, unknown>) {
  const output = { ...input };

  if ('sort_order' in output) output.sort_order = normalizeOptionalInteger(output.sort_order, 0);
  if ('is_deleted' in output) output.is_deleted = normalizeOptionalBooleanNumber(output.is_deleted, 0);
  if ('status' in output) output.status = normalizeActiveInactiveStatus(output.status, 'active');

  return output;
}

function normalizeAutoMxhProductPatch(input: Record<string, unknown>) {
  const output = { ...input };

  if ('category_id' in output) output.category_id = normalizeOptionalInteger(output.category_id, 0);
  if ('api_provider_id' in output) output.api_provider_id = normalizeOptionalInteger(output.api_provider_id, 0);
  if ('api_service_id' in output) output.api_service_id = normalizeOptionalInteger(output.api_service_id, 0);
  if ('price' in output) output.price = normalizeOptionalNumber(output.price, 0);
  if ('cost' in output) output.cost = normalizeOptionalNumber(output.cost, 0);
  if ('is_deleted' in output) output.is_deleted = normalizeOptionalBooleanNumber(output.is_deleted, 0);
  if ('status' in output) output.status = normalizeActiveInactiveStatus(output.status, 'active');

  return output;
}

function isAutoMxhRefundedStatus(status: string) {
  return ['refund', 'refunded'].includes(status);
}

function normalizeAutoMxhOrderStatus(value: unknown, fallback = 'pending') {
  const normalized = String(value || '').trim().toLowerCase();

  if (['pending', 'processing', 'completed', 'canceled', 'refunded'].includes(normalized)) {
    return normalized;
  }

  if (normalized === 'cancelled') {
    return 'canceled';
  }

  if (normalized === 'refund') {
    return 'refunded';
  }

  return normalized || fallback;
}

function appendAutoMxhOrderStatusFilter(status: string, conditions: string[], values: unknown[]) {
  const normalized = normalizeAutoMxhOrderStatus(status);

  if (normalized === 'refunded') {
    conditions.push(`(
      LOWER(COALESCE(o.status, '')) IN ('refund', 'refunded')
      OR COALESCE(o.is_refunded, 0) = 1
      OR COALESCE(o.refund_amount, 0) > 0
    )`);
    return;
  }

  if (normalized === 'canceled') {
    conditions.push(`(
      LOWER(COALESCE(o.status, '')) IN ('canceled', 'cancelled')
      AND COALESCE(o.is_refunded, 0) = 0
      AND COALESCE(o.refund_amount, 0) <= 0
    )`);
    return;
  }

  conditions.push('LOWER(COALESCE(o.status, \'\')) = ?');
  values.push(normalized);
}

async function ensureAutoMxhOrderStatusColumn() {
  const columns = await getRawTableColumns('automxh_orders');
  if (!columns.has('status')) {
    return columns;
  }

  const types = await getRawColumnTypes('automxh_orders');
  const statusType = types.get('status') || '';

  if (!/varchar\(\d+\)/i.test(statusType) && !/enum\(/i.test(statusType)) {
    return columns;
  }

  if (statusType.includes('enum(') && !statusType.includes('refunded')) {
    await db.$executeRawUnsafe(
      "ALTER TABLE `automxh_orders` MODIFY `status` VARCHAR(40) NOT NULL DEFAULT 'pending'"
    ).catch(() => undefined);
    rawTableColumnCache.delete('automxh_orders');
  }

  return getRawTableColumns('automxh_orders');
}

let ensuredAutoMxhRefundColumns = false;

async function ensureAutoMxhRefundColumns() {
  const table = 'automxh_orders';
  await ensureAutoMxhOrderStatusColumn();
  const columns = await getRawTableColumns(table);
  if (ensuredAutoMxhRefundColumns) {
    return columns;
  }

  if (!columns.has('is_refunded')) {
    await db.$executeRawUnsafe(
      'ALTER TABLE `automxh_orders` ADD COLUMN `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`'
    ).then(() => {
      columns.add('is_refunded');
    }).catch(() => undefined);
  }

  if (!columns.has('refund_amount')) {
    const afterColumn = columns.has('is_refunded') ? 'is_refunded' : 'status';
    await db.$executeRawUnsafe(
      `ALTER TABLE \`automxh_orders\` ADD COLUMN \`refund_amount\` DECIMAL(15, 4) NOT NULL DEFAULT 0.0000 AFTER \`${afterColumn}\``
    ).then(() => {
      columns.add('refund_amount');
    }).catch(() => undefined);
  }

  if (!columns.has('reason')) {
    const afterColumn = columns.has('refund_amount') ? 'refund_amount' : 'status';
    await db.$executeRawUnsafe(
      `ALTER TABLE \`automxh_orders\` ADD COLUMN \`reason\` TEXT NULL AFTER \`${afterColumn}\``
    ).then(() => {
      columns.add('reason');
    }).catch(() => undefined);
  }

  if (!columns.has('is_refunded') || !columns.has('refund_amount') || !columns.has('reason')) {
    rawTableColumnCache.delete(table);
    const refreshedColumns = await getRawTableColumns(table);
    ensuredAutoMxhRefundColumns =
      refreshedColumns.has('is_refunded') && refreshedColumns.has('refund_amount') && refreshedColumns.has('reason');
    return refreshedColumns;
  }

  ensuredAutoMxhRefundColumns = true;
  return columns;
}

function buildAutoMxhOrderPatch(columns: Set<string>, patch: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(patch).filter(([field]) => columns.has(field)));
}

async function updateAutoMxhOrderPatch(
  tx: Prisma.TransactionClient,
  id: number,
  columns: Set<string>,
  patch: Record<string, unknown>
) {
  const filteredPatch = buildAutoMxhOrderPatch(columns, patch);
  const fields = Object.keys(filteredPatch);
  if (fields.length === 0) {
    return;
  }

  await tx.$executeRawUnsafe(
    `UPDATE \`automxh_orders\` SET ${fields.map((field) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
    ...fields.map((field) => filteredPatch[field]),
    id
  );
}

function normalizeFindJobStatus(value: unknown, fallback: 'open' | 'filled' | 'closed' = 'open') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['open', 'active', 'approved', 'publish', 'published', 'dang mo', 'da duyet'].includes(normalized)) return 'open';
  if (['filled', 'done', 'completed', 'da nhan', 'da du nguoi'].includes(normalized)) return 'filled';
  if (['closed', 'close', 'rejected', 'hidden', 'deleted', 'inactive', 'dang tat', 'tu choi'].includes(normalized)) return 'closed';
  if (['pending', 'review', 'waiting', 'cho duyet', 'dang cho'].includes(normalized)) return 'open';

  return fallback;
}

function normalizeFindJobApprovalStatus(value: unknown, fallback: 'pending' | 'approved' | 'rejected' = 'pending') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['approved', 'open', 'active', 'publish', 'published', 'da duyet'].includes(normalized)) return 'approved';
  if (['rejected', 'closed', 'hidden', 'deleted', 'tu choi'].includes(normalized)) return 'rejected';
  if (['pending', 'review', 'waiting', 'cho duyet', 'dang cho'].includes(normalized)) return 'pending';

  return fallback;
}

function normalizeFindJobPatch(table: string, input: Record<string, unknown>, columnTypes: Map<string, string>) {
  const output = { ...input };

  if ('status' in output) {
    const rawStatus = output.status;
    output.status = normalizeFindJobStatus(rawStatus, 'open');
    const normalizedRaw = String(rawStatus || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (columnTypes.has('approval_status') && ['pending', 'review', 'waiting', 'cho duyet', 'dang cho'].includes(normalizedRaw)) {
      output.approval_status = 'pending';
    }
    if (columnTypes.has('approval_status') && ['rejected', 'hidden', 'deleted', 'tu choi', 'closed', 'close'].includes(normalizedRaw)) {
      output.approval_status = 'rejected';
    }
    if (columnTypes.has('approval_status') && ['approved', 'open', 'active', 'publish', 'published', 'da duyet'].includes(normalizedRaw)) {
      output.approval_status = 'approved';
    }
  }

  if ('approval_status' in output) {
    output.approval_status = normalizeFindJobApprovalStatus(output.approval_status, 'pending');
  }

  return output;
}

async function normalizeRawTablePayload(table: string, data: Record<string, unknown>) {
  if (Object.keys(data).length === 0) {
    return data;
  }

  const columnTypes = await getRawColumnTypes(table).catch(() => new Map<string, string>());
  const output = { ...data };

  for (const [field, value] of Object.entries(output)) {
    const type = columnTypes.get(field) || '';
    const isNumericColumn = /^(?:tiny|small|medium|big)?int|decimal|double|float/.test(type);

    if (isNumericColumn && value === '') {
      output[field] = null;
    }

    if (/^(?:tiny|small|medium|big)?int/.test(type) && output[field] !== null && output[field] !== undefined) {
      output[field] = Math.trunc(toNumber(output[field], 0));
    }

    if (/^(?:decimal|double|float)/.test(type) && output[field] !== null && output[field] !== undefined) {
      output[field] = toNumber(output[field], 0);
    }
  }

  if (table === 'automxh_categories') {
    return normalizeAutoMxhCategoryPatch(output);
  }

  if (table === 'automxh_products') {
    return normalizeAutoMxhProductPatch(output);
  }

  if (table === 'automxh_variants') {
    const normalized = normalizeAutoMxhVariantPatch(output);
    if ('quantity' in normalized) {
      normalized.quantity = Math.max(1, normalizeOptionalInteger(normalized.quantity, 1));
    }
    return normalized;
  }

  if (table === 'find_job_jobs' || table === 'find_jobs') {
    return normalizeFindJobPatch(table, output, columnTypes);
  }

  if (table === 'meta_support_orders') {
    if ('quantity' in output) output.quantity = Math.max(1, normalizeOptionalInteger(output.quantity, 1));
    if ('price' in output) output.price = normalizeOptionalNumber(output.price, 0);
    if ('status' in output) output.status = normalizeMetaSupportStatus(output.status);
    return output;
  }

  if (table === 'vibe_code_packages' || table === 'vibe_code_orders') {
    const now = getVietnamDatabaseDateTime();
    if (columnTypes.has('updated_at')) {
      output.updated_at = now;
    }
    return output;
  }

  if (table === 'web_service_packages' || table === 'web_service_orders') {
    const now = getVietnamDatabaseDateTime();
    if (columnTypes.has('updated_at')) {
      output.updated_at = now;
    }
    return output;
  }

  if (table === 'press_publications' || table === 'press_orders') {
    const now = getUtcDatabaseDateTime();
    if (columnTypes.has('updated_at')) {
      output.updated_at = now;
    }
    return output;
  }

  return output;
}

function coerceInput(field: string, value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    if (isNullableDateField(field)) {
      return null;
    }
    if (isNullableBooleanField(field)) {
      return null;
    }
    return '';
  }

  if (isNullableBooleanField(field)) {
    const normalized = trimmed.toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
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
    const orFilters: Array<Record<string, unknown>> = [
      ...config.searchFields.map((field) => ({ [field]: { contains: search } })),
    ];

    if (!Number.isNaN(numericSearch)) {
      orFilters.push({ id: numericSearch });
      if (config.select && 'user_id' in config.select) {
        orFilters.push({ user_id: numericSearch });
      }
    }

    where.OR = orFilters;
  }

  if (status && config.statusField) {
    where[config.statusField] = status;
  }

  if (config.delegate === 'transactions' && resource === 'deposits') {
    where.type = 'deposit';
  }

  if (resource === 'users') {
    where.status = status || { notIn: ['banned', 'suspended'] };
  }

  return where;
}

const SMM_STATUS_VARIANTS: Record<string, string[]> = {
  Processing: ['processing', 'in progress', 'in_progress', 'inprogress', 'running', 'active', 'pending', '0'],
  Completed: ['completed', 'complete', 'success', '200', 'done'],
  Refunded: ['refunded', 'refund', 'partial'],
  Canceled: ['canceled', 'cancelled', 'failed', 'error'],
};

function normalizeSmmStatus(value: unknown) {
  return normalizeSmmOrderStatus(value);
}

function getSmmStatusFilterVariants(value: string) {
  const canonical = normalizeSmmStatus(value);
  return SMM_STATUS_VARIANTS[canonical] || [String(value || '').trim().toLowerCase()];
}

interface CategoryTreeNode extends Record<string, unknown> {
  id: number;
  name: string;
  slug?: string | null;
  sort_order?: number | null;
  status?: string | null;
}

export async function listAdminResource(resource: string, params: URLSearchParams) {
  const config = getConfig(resource);
  const page = Math.max(1, Number(params.get('page') || 1));
  const perPage = Math.min(100, Math.max(5, Number(params.get('per_page') || 25)));
  const skip = (page - 1) * perPage;

  if (resource === 'registration-ips') {
    return listRegistrationIps(config, params, page, perPage, skip);
  }

  if (resource === 'smm-services') {
    return listLegacySmmServices(config, params, page, perPage, skip);
  }

  if (resource === 'smm-orders') {
    return listLegacySmmOrders(config, params, page, perPage, skip);
  }

  if (resource === 'automxh-categories') {
    return listAutoMxhCategories(config, params, page, perPage, skip);
  }

  if (resource === 'automxh-products') {
    return listAutoMxhProducts(config, params, page, perPage, skip);
  }

  if (resource === 'automxh-variants') {
    return listAutoMxhVariants(config, params, page, perPage, skip);
  }

  if (resource === 'automxh-orders') {
    return listLegacyAutoMxhOrders(config, params, page, perPage, skip);
  }

  if (resource === 'vibe-code-orders') {
    return listVibeCodeOrders(config, params, page, perPage, skip);
  }

  if (resource === 'kenh-tiktok-settings') {
    return listKenhGiaReSettings(params, page, perPage, skip);
  }

  if (resource === 'tiktok-channel-orders') {
    return listAdminTikTokChannelOrders(params, page, perPage, skip);
  }

  if (resource === 'forum-threads') {
    return listForumThreads(config, params, page, perPage, skip);
  }

  if (resource === 'forum-posts') {
    return listForumPosts(config, params, page, perPage, skip);
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

async function listLegacySmmOrders(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search) {
    const like = `%${search}%`;
    conditions.push(`(
      CAST(so.id AS CHAR) LIKE ?
      OR CAST(so.user_id AS CHAR) LIKE ?
      OR COALESCE(so.api_order_id, '') LIKE ?
      OR COALESCE(so.service_name, '') LIKE ?
      OR COALESCE(so.link, '') LIKE ?
      OR COALESCE(u.username, '') LIKE ?
      OR COALESCE(ap.name, '') LIKE ?
    )`);
    values.push(like, like, like, like, like, like, like);
  }

  if (status) {
    const normalized = normalizeSmmStatus(status);
    const variants = getSmmStatusFilterVariants(normalized);
    conditions.push(`LOWER(COALESCE(so.status, '')) IN (${variants.map(() => '?').join(', ')})`);
    values.push(...variants);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromSql = `
    FROM smm_orders so
    LEFT JOIN users u ON u.id = so.user_id
    LEFT JOIN api_providers ap ON ap.id = so.provider_id
    ${whereSql}
  `;

  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT
          so.*,
          u.username,
          u.fullname,
          ap.name AS provider_name
        ${fromSql}
        ORDER BY so.updated_at DESC, so.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total ${fromSql}`,
      ...values
    ),
  ]);

  const data = rows.map((row) => ({
    ...row,
    username: String(row.username || row.fullname || `user_${row.user_id || '0'}`),
    provider_name: String(row.provider_name || `Provider #${row.provider_id || 0}`),
    status: normalizeSmmStatus(row.status),
  }));

  const total = Number(countRows[0]?.total || 0);
  return {
    success: true,
    title: config.title,
    data: normalizeValue(data),
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

async function listLegacySmmServices(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const providerId = Math.max(0, Math.trunc(toNumber(params.get('provider_id'), 0)));
  const category = (params.get('category') || '').trim();
  const values: unknown[] = [];
  const conditions: string[] = ['COALESCE(s.is_deleted, 0) = 0'];

  if (search) {
    const like = `%${search}%`;
    conditions.push(`(
      s.name LIKE ?
      OR COALESCE(s.original_name, '') LIKE ?
      OR COALESCE(s.category, '') LIKE ?
      OR COALESCE(s.type, '') LIKE ?
      OR COALESCE(p.name, '') LIKE ?
      OR CAST(s.service_id AS CHAR) LIKE ?
      OR CAST(s.provider_id AS CHAR) LIKE ?
    )`);
    values.push(like, like, like, like, like, like, like);
  }

  if (status && config.statusField) {
    conditions.push('COALESCE(s.status, \'active\') = ?');
    values.push(status);
  }

  if (providerId > 0) {
    conditions.push('s.provider_id = ?');
    values.push(providerId);
  }

  if (category) {
    conditions.push('(s.category = ? OR s.category LIKE ?)');
    values.push(category, `${category}%`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromSql = `
    FROM smm_services_cache s
    LEFT JOIN api_providers p ON p.id = s.provider_id
    ${whereSql}
  `;

  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT s.*, p.name AS provider_name
        ${fromSql}
        ORDER BY s.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `
        SELECT COUNT(*) AS total
        ${fromSql}
      `,
      ...values
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  const categoryRows = await db.$queryRawUnsafe<Array<{ category: string | null }>>(
    `
      SELECT DISTINCT s.category
      ${fromSql}
      ORDER BY s.category ASC
      LIMIT 400
    `,
    ...values
  ).catch(() => []);
  return {
    success: true,
    title: config.title,
    data: normalizeValue(rows),
    meta: {
      category_options: categoryRows
        .map((row) => String(row.category || '').trim())
        .filter(Boolean),
    },
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

async function listLegacyAutoMxhOrders(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  await ensureAutoMxhRefundColumns();
  const productColumns = await getRawTableColumns('automxh_products').catch(() => new Set<string>());
  const productOptionalSelect = (column: string) => productColumns.has(column) ? `p.\`${column}\`` : "''";
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search) {
    const like = `%${search}%`;
    conditions.push(`(
      CAST(o.id AS CHAR) LIKE ?
      OR CAST(o.user_id AS CHAR) LIKE ?
      OR COALESCE(o.link, '') LIKE ?
      OR COALESCE(o.api_order_id, '') LIKE ?
      OR COALESCE(u.username, '') LIKE ?
      OR COALESCE(u.fullname, '') LIKE ?
      OR COALESCE(p.name, '') LIKE ?
      OR COALESCE(v.name, '') LIKE ?
    )`);
    values.push(like, like, like, like, like, like, like, like);
  }

  if (status && config.statusField) {
    appendAutoMxhOrderStatusFilter(status, conditions, values);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromSql = `
    FROM automxh_orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN automxh_products p ON p.id = o.product_id
    LEFT JOIN automxh_variants v ON v.id = o.variant_id
    ${whereSql}
  `;

  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT
          o.*,
          u.username,
          u.fullname,
          u.telegram_username,
          p.name AS product_name,
          ${productOptionalSelect('input_label')} AS input_label,
          ${productOptionalSelect('buyer_label')} AS buyer_label,
          ${productOptionalSelect('custom_inputs')} AS custom_inputs,
          v.name AS variant_name
        ${fromSql}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `
        SELECT COUNT(*) AS total
        ${fromSql}
      `,
      ...values
    ),
  ]);

  const hydratedRows = rows.map((row) => ({
    ...row,
    buyer_info_display: decryptLegacyData(String(row.buyer_info || '')),
    custom_value_display: decryptLegacyData(String(row.custom_value || '')),
    additional_files_list: parseStringList(row.additional_files),
    display_name: String(row.fullname || row.username || ''),
  }));

  const total = Number(countRows[0]?.total || 0);
  return {
    success: true,
    title: config.title,
    data: normalizeValue(hydratedRows),
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

async function listVibeCodeOrders(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  await ensureVibeCodeTables();
  const table = 'vibe_code_orders';
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search) {
    const like = `%${search}%`;
    conditions.push(`(
      CAST(o.id AS CHAR) LIKE ?
      OR CAST(o.user_id AS CHAR) LIKE ?
      OR COALESCE(o.order_code, '') LIKE ?
      OR COALESCE(o.provider, '') LIKE ?
      OR COALESCE(o.package_key, '') LIKE ?
      OR COALESCE(o.package_title, '') LIKE ?
      OR COALESCE(o.status, '') LIKE ?
      OR COALESCE(o.admin_note, '') LIKE ?
      OR COALESCE(u.username, '') LIKE ?
      OR COALESCE(u.fullname, '') LIKE ?
    )`);
    values.push(like, like, like, like, like, like, like, like, like, like);
  }

  if (status && config.statusField) {
    conditions.push(`o.\`${config.statusField}\` = ?`);
    values.push(status);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromSql = `
    FROM \`${table}\` o
    LEFT JOIN users u ON u.id = o.user_id
    ${whereSql}
  `;

  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT
          o.*,
          COALESCE(NULLIF(u.username, ''), NULLIF(u.fullname, ''), CONCAT('User #', o.user_id)) AS username,
          u.email AS user_email
        ${fromSql}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total ${fromSql}`,
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
}

async function listForumThreads(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const normalizedStatus = status.toLowerCase();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search) {
    const like = `%${search}%`;
    conditions.push(`(
      CAST(t.id AS CHAR) LIKE ?
      OR CAST(t.user_id AS CHAR) LIKE ?
      OR COALESCE(t.title, '') LIKE ?
      OR COALESCE(t.slug, '') LIKE ?
      OR COALESCE(t.status, '') LIKE ?
      OR COALESCE(p.content, '') LIKE ?
    )`);
    values.push(like, like, like, like, like, like);
  }

  if (normalizedStatus === 'deleted') {
    conditions.push('COALESCE(t.is_deleted, 0) = 1');
  } else {
    conditions.push('COALESCE(t.is_deleted, 0) = 0');
  }

  if (status && normalizedStatus !== 'deleted') {
    conditions.push('COALESCE(t.status, \'\') = ?');
    values.push(status);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromSql = `
    FROM forum_threads t
    LEFT JOIN forum_posts p
      ON p.id = (
        SELECT fp.id
        FROM forum_posts fp
        WHERE fp.thread_id = t.id
          AND fp.is_first_post = 1
          AND COALESCE(fp.is_deleted, 0) = 0
        ORDER BY fp.id ASC
        LIMIT 1
      )
    ${whereSql}
  `;

  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT
          t.*,
          p.content AS content,
          ${forumVietnamTimestampSql('t.created_at')} AS created_at,
          ${forumVietnamTimestampSql('t.updated_at')} AS updated_at
        ${fromSql}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total ${fromSql}`,
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
}

async function listAutoMxhCategories(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const table = await getActualRawTable(config);
  if (!(await tableExists(table))) {
    return {
      success: true,
      title: config.title,
      data: [],
      pagination: { page, per_page: perPage, total: 0, total_pages: 1 },
      readonly: Boolean(config.readonly),
      create_fields: config.createFields || [],
      update_fields: config.updateFields || [],
    };
  }

  const columns = await getRawTableColumns(table);
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (columns.has('is_deleted')) {
    conditions.push('COALESCE(`is_deleted`, 0) = 0');
  }

  if (search) {
    conditions.push('(`name` LIKE ? OR COALESCE(`slug`, \'\') LIKE ? OR COALESCE(`description`, \'\') LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status && columns.has('status')) {
    conditions.push('COALESCE(`status`, \'active\') = ?');
    values.push(status);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.$queryRawUnsafe<CategoryTreeNode[]>(
    `
      SELECT c.*,
             (
               SELECT COUNT(*)
               FROM automxh_products p
               WHERE p.category_id = c.id
                 AND COALESCE(p.is_deleted, 0) = 0
             ) AS product_count
      FROM \`${table}\` c
      ${whereSql}
      ORDER BY COALESCE(c.\`sort_order\`, 0) ASC, c.\`id\` ASC
    `,
    ...values
  );
  const pageRows = rows.slice(skip, skip + perPage);
  return {
    success: true,
    title: config.title,
    data: normalizeValue(pageRows),
    pagination: {
      page,
      per_page: perPage,
      total: rows.length,
      total_pages: Math.max(1, Math.ceil(rows.length / perPage)),
    },
    readonly: Boolean(config.readonly),
    create_fields: config.createFields || [],
    update_fields: config.updateFields || [],
  };
}

async function listAutoMxhProducts(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const table = await getActualRawTable(config);
  if (!(await tableExists(table))) {
    return {
      success: true,
      title: config.title,
      data: [],
      meta: { category_options: [] },
      pagination: { page, per_page: perPage, total: 0, total_pages: 1 },
      readonly: Boolean(config.readonly),
      create_fields: config.createFields || [],
      update_fields: config.updateFields || [],
    };
  }

  const columns = await getRawTableColumns(table);
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const categoryId = Math.max(0, Math.trunc(toNumber(params.get('category_id'), 0)));
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (columns.has('is_deleted')) {
    conditions.push('COALESCE(`is_deleted`, 0) = 0');
  }

  if (search) {
    const searchConditions = ['`name` LIKE ?'];
    values.push(`%${search}%`);
    if (columns.has('slug')) {
      searchConditions.push('COALESCE(`slug`, \'\') LIKE ?');
      values.push(`%${search}%`);
    }
    if (columns.has('description')) {
      searchConditions.push('COALESCE(`description`, \'\') LIKE ?');
      values.push(`%${search}%`);
    }
    if (columns.has('badge')) {
      searchConditions.push('COALESCE(`badge`, \'\') LIKE ?');
      values.push(`%${search}%`);
    }
    if (columns.has('api_service_id')) {
      searchConditions.push('CAST(COALESCE(`api_service_id`, \'\') AS CHAR) LIKE ?');
      values.push(`%${search}%`);
    }
    conditions.push(`(${searchConditions.join(' OR ')})`);
  }

  if (status && columns.has('status')) {
    conditions.push('COALESCE(`status`, \'active\') = ?');
    values.push(status);
  }

  if (categoryId > 0 && columns.has('category_id')) {
    conditions.push('`category_id` = ?');
    values.push(categoryId);
  }

  const prefixedWhereSql = conditions.length
    ? `WHERE ${conditions
        .map((condition) =>
          condition
            .replace(/COALESCE\(`is_deleted`/g, 'COALESCE(p.`is_deleted`')
            .replace(/COALESCE\(`status`/g, 'COALESCE(p.`status`')
            .replace(/\(`name`/g, '(p.`name`')
            .replace(/COALESCE\(`slug`/g, 'COALESCE(p.`slug`')
            .replace(/COALESCE\(`description`/g, 'COALESCE(p.`description`')
            .replace(/COALESCE\(`badge`/g, 'COALESCE(p.`badge`')
            .replace(/COALESCE\(`api_service_id`/g, 'COALESCE(p.`api_service_id`')
            .replace(/`category_id`/g, 'p.`category_id`')
        )
        .join(' AND ')}`
    : '';
  const hasAutomxhCategoriesTable = await tableExists('automxh_categories');
  const categoryJoinSql = hasAutomxhCategoriesTable ? 'LEFT JOIN automxh_categories c ON c.id = p.category_id' : '';
  const categoryNameSelect = hasAutomxhCategoriesTable ? 'c.name AS category_name' : 'NULL AS category_name';
  const variantDeletedCondition = (await getRawTableColumns('automxh_variants').catch(() => new Set<string>())).has('is_deleted')
    ? 'AND COALESCE(v.is_deleted, 0) = 0'
    : '';
  const orderSql = columns.has('updated_at') ? 'p.updated_at DESC, p.id DESC' : 'p.id DESC';
  const [rows, countRows, categoryRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT p.*,
               ${categoryNameSelect},
               (
                 SELECT COUNT(*)
                 FROM automxh_variants v
                 WHERE v.product_id = p.id
                   ${variantDeletedCondition}
               ) AS variant_count
        FROM \`${table}\` p
        ${categoryJoinSql}
        ${prefixedWhereSql}
        ORDER BY ${orderSql}
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total FROM \`${table}\` ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      ...values
    ),
    hasAutomxhCategoriesTable
      ? db.$queryRawUnsafe<CategoryTreeNode[]>(
          `
            SELECT id, name, slug, sort_order, status
            FROM \`automxh_categories\`
            WHERE COALESCE(\`is_deleted\`, 0) = 0 OR \`is_deleted\` IS NULL
            ORDER BY COALESCE(\`sort_order\`, 0) ASC, \`id\` ASC
          `
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  const options = categoryRows
    .map((row) => ({
      value: String(row.id),
      label: String(row.name || `#${row.id}`),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  const enrichedRows = rows.map((row) => {
    return {
      ...row,
      category_name: String(row.category_name || ''),
      category_path: String(row.category_name || ''),
    };
  });

  const total = Number(countRows[0]?.total || 0);
  return {
    success: true,
    title: config.title,
    data: normalizeValue(enrichedRows),
    meta: {
      category_options: options,
    },
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

async function listAutoMxhVariants(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const table = await getActualRawTable(config);
  const hasTable = await tableExists(table);
  const hasProductsTable = await tableExists('automxh_products');
  const hasCategoriesTable = await tableExists('automxh_categories');

  if (!hasTable) {
    return {
      success: true,
      title: config.title,
      data: [],
      meta: { category_options: [], product_options: [] },
      pagination: { page, per_page: perPage, total: 0, total_pages: 1 },
      readonly: Boolean(config.readonly),
      create_fields: config.createFields || [],
      update_fields: config.updateFields || [],
    };
  }

  const columns = await getRawTableColumns(table);
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const categoryId = Math.max(0, Math.trunc(toNumber(params.get('category_id'), 0)));
  const productId = Math.max(0, Math.trunc(toNumber(params.get('product_id'), 0)));
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (columns.has('is_deleted')) {
    conditions.push('COALESCE(`is_deleted`, 0) = 0');
  }

  if (search) {
    conditions.push('(`name` LIKE ? OR COALESCE(`description`, \'\') LIKE ? OR COALESCE(`badge`, \'\') LIKE ? OR COALESCE(`type`, \'\') LIKE ? OR CAST(COALESCE(`api_service_id`, \'\') AS CHAR) LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status && columns.has('status')) {
    conditions.push('COALESCE(`status`, \'active\') = ?');
    values.push(status);
  }

  if (productId > 0 && columns.has('product_id')) {
    conditions.push('`product_id` = ?');
    values.push(productId);
  }

  if (categoryId > 0 && columns.has('product_id') && hasProductsTable) {
    conditions.push('EXISTS (SELECT 1 FROM automxh_products fp WHERE fp.id = `product_id` AND fp.category_id = ?)');
    values.push(categoryId);
  }

  const prefixedWhereSql = conditions.length
    ? `WHERE ${conditions
        .map((condition) =>
          condition
            .replace(/COALESCE\(`is_deleted`/g, 'COALESCE(v.`is_deleted`')
            .replace(/COALESCE\(`status`/g, 'COALESCE(v.`status`')
            .replace(/\(`name`/g, '(v.`name`')
            .replace(/COALESCE\(`description`/g, 'COALESCE(v.`description`')
            .replace(/COALESCE\(`badge`/g, 'COALESCE(v.`badge`')
            .replace(/COALESCE\(`type`/g, 'COALESCE(v.`type`')
            .replace(/COALESCE\(`api_service_id`/g, 'COALESCE(v.`api_service_id`')
            .replace(/`product_id`/g, 'v.`product_id`')
        )
        .join(' AND ')}`
    : '';

  const selectRelationSql = hasProductsTable
    ? `
        v.*,
        p.name AS product_name,
        p.category_id AS category_id,
        ${hasCategoriesTable ? 'c.name' : 'NULL'} AS category_name
      `
    : `
        v.*,
        NULL AS product_name,
        NULL AS category_id,
        NULL AS category_name
      `;
  const joinRelationSql = hasProductsTable
    ? `
        LEFT JOIN automxh_products p ON p.id = v.product_id
        ${hasCategoriesTable ? 'LEFT JOIN automxh_categories c ON c.id = p.category_id' : ''}
      `
    : '';
  const orderRelationSql = hasProductsTable
    ? hasCategoriesTable
      ? 'COALESCE(c.`sort_order`, 0) ASC, c.`id` ASC, p.`id` ASC, v.`id` ASC'
      : 'p.`id` ASC, v.`id` ASC'
    : 'v.`id` ASC';

  const [rows, countRows, productRows, categoryRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT ${selectRelationSql}
        FROM \`${table}\` v
        ${joinRelationSql}
        ${prefixedWhereSql}
        ORDER BY ${orderRelationSql}
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total FROM \`${table}\` ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      ...values
    ),
    hasProductsTable
      ? db.$queryRawUnsafe<Array<{ id: number | bigint; name: string; category_id: number | bigint | null; category_name: string | null }>>(
          `
            SELECT p.id, p.name, p.category_id, ${hasCategoriesTable ? 'c.name' : 'NULL'} AS category_name
            FROM automxh_products p
            ${hasCategoriesTable ? 'LEFT JOIN automxh_categories c ON c.id = p.category_id' : ''}
            WHERE COALESCE(p.is_deleted, 0) = 0 OR p.is_deleted IS NULL
            ORDER BY ${hasCategoriesTable ? 'COALESCE(c.sort_order, 0) ASC, c.id ASC,' : ''} p.id ASC
          `
        ).catch(() => [])
      : Promise.resolve([]),
    hasCategoriesTable
      ? db.$queryRawUnsafe<CategoryTreeNode[]>(
          `
            SELECT id, name, slug, sort_order, status
            FROM automxh_categories
            WHERE COALESCE(\`is_deleted\`, 0) = 0 OR \`is_deleted\` IS NULL
            ORDER BY COALESCE(\`sort_order\`, 0) ASC, \`id\` ASC
          `
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  const categoryOptions = categoryRows
    .map((row) => ({
      value: String(row.id),
      label: String(row.name || `#${row.id}`),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'vi'));

  const productOptions = productRows
    .map((row) => {
      const categoryName = String(row.category_name || '').trim();
      const name = String(row.name || `Dịch vụ #${row.id}`);
      return {
        value: String(row.id),
        label: categoryName ? `${categoryName} / ${name}` : name,
        category_id: row.category_id === null || row.category_id === undefined ? '' : String(row.category_id),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, 'vi'));

  const enrichedRows = rows.map((row) => {
    const categoryName = String(row.category_name || '').trim();
    const productName = String(row.product_name || '').trim();
    return {
      ...row,
      product_name: productName,
      category_name: categoryName,
      product_path: [categoryName, productName].filter(Boolean).join(' / '),
    };
  });

  const total = Number(countRows[0]?.total || 0);
  return {
    success: true,
    title: config.title,
    data: normalizeValue(enrichedRows),
    meta: {
      category_options: categoryOptions,
      product_options: productOptions,
    },
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

async function listForumPosts(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const normalizedStatus = status.toLowerCase();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search) {
    const like = `%${search}%`;
    conditions.push(`(
      CAST(p.id AS CHAR) LIKE ?
      OR CAST(p.thread_id AS CHAR) LIKE ?
      OR CAST(p.user_id AS CHAR) LIKE ?
      OR COALESCE(p.content, '') LIKE ?
      OR COALESCE(p.status, '') LIKE ?
    )`);
    values.push(like, like, like, like, like);
  }

  if (normalizedStatus === 'deleted') {
    conditions.push('COALESCE(p.is_deleted, 0) = 1');
  } else {
    conditions.push('COALESCE(p.is_deleted, 0) = 0');
  }

  if (status && normalizedStatus !== 'deleted') {
    conditions.push('COALESCE(p.status, \'\') = ?');
    values.push(status);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromSql = `FROM forum_posts p ${whereSql}`;

  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT
          p.*,
          ${forumVietnamTimestampSql('p.created_at')} AS created_at,
          ${forumVietnamTimestampSql('p.updated_at')} AS updated_at
        ${fromSql}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total ${fromSql}`,
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
}

async function listRawTable(config: ResourceConfig, params: URLSearchParams, page: number, perPage: number, skip: number) {
  const table = await getActualRawTable(config);
  const hasFindJobPinColumn = config.table === 'find_jobs' ? await ensureFindJobPinColumn(table as 'find_job_jobs' | 'find_jobs') : false;
  if (!(await tableExists(table))) {
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
      warning: `Bảng ${table} chưa tồn tại trong cơ sở dữ liệu hiện tại`,
    };
  }
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search && config.searchFields.length > 0) {
    conditions.push(`(${config.searchFields.map((field) => `\`${field}\` LIKE ?`).join(' OR ')})`);
    values.push(...config.searchFields.map(() => `%${search}%`));
  }

  if (status && config.statusField) {
    if (config.table === 'find_jobs' && ['pending', 'approved', 'rejected'].includes(status)) {
      conditions.push('`approval_status` = ?');
      values.push(status);
    } else {
      conditions.push(`\`${config.statusField}\` = ?`);
      values.push(status);
    }
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

  if (resource === 'users') {
    delete data.role;
    delete data.balance;
    delete data.game_balance;
    if (typeof data.email !== 'undefined') {
      data.email = await assertUserEmailAvailable(normalizeUserEmail(data.email));
    }
  }

  if (resource === 'users' && typeof data.password === 'string') {
    const bcrypt = await import('bcryptjs');
    data.password = await bcrypt.hash(data.password, 10);
  }

  const normalizedData = resource === 'automxh-variants'
    ? normalizeAutoMxhVariantPatch(data)
    : normalizePrismaPayload(config, data);

  let created: unknown;
  if (config.table) {
    created = await insertRawTable(config, normalizedData);
  } else {
    const delegate = getDelegate(config);
    created = await delegate.create({ data: normalizedData });
  }

  if (resource === 'settings') {
    invalidateLegacySettingsCache();
  }

  if (resource === 'kenh-tiktok-settings') {
    await invalidateKenhGiaReSettingsCache();
  }

  if (resource === 'users' && created && typeof created === 'object' && 'id' in (created as Record<string, unknown>)) {
    const userId = Number((created as Record<string, unknown>).id || 0);
    if (userId > 0) {
      await ensureGameApiKeyForUser(userId).catch(() => undefined);
    }
  }

  await logAdminAction({ adminId, action: `create ${resource}`, target: JSON.stringify(normalizedData), req });
  return { success: true, data: normalizeValue(created) };
}

export async function updateAdminResource(resource: string, id: number, input: Record<string, unknown>, adminId: number, req: NextRequest) {
  const config = getConfig(resource);
  if (config.readonly) {
    throw new Error('Resource chỉ đọc');
  }

  let data = sanitizeData(input, config.updateFields);
  if (Object.keys(data).length === 0) {
    throw new Error('Không có dữ liệu cập nhật hợp lệ');
  }

  let previousUserSnapshot: { username: string | null; balance: unknown; game_balance: unknown } | null = null;
  if (resource === 'users') {
    const wantsBalancePatch =
      Object.prototype.hasOwnProperty.call(data, 'balance') ||
      Object.prototype.hasOwnProperty.call(data, 'game_balance');
    const wantsRolePatch = Object.prototype.hasOwnProperty.call(data, 'role');
    if (typeof data.email !== 'undefined') {
      data.email = await assertUserEmailAvailable(normalizeUserEmail(data.email), id);
    }
    const [target, admin] = await Promise.all([
      db.users.findUnique({
        where: { id },
        select: { username: true, role: true, balance: true, game_balance: true },
      }).catch(() => null),
      db.users.findUnique({
        where: { id: adminId },
        select: { role: true },
      }).catch(() => null),
    ]);
    if (!target) {
      throw new Error('Không tìm thấy tài khoản cần cập nhật.');
    }
    if (String(target?.role || '').toLowerCase() === 'owner') {
      throw new Error('Không thể chỉnh tài khoản owner qua màn quản lý user.');
    }
    previousUserSnapshot = {
      username: target.username,
      balance: target.balance,
      game_balance: target.game_balance,
    };

    const currentAdminIsOwner = isOwnerRole(admin?.role);
    if (!currentAdminIsOwner) {
      delete data.role;
      delete data.balance;
      delete data.game_balance;
    } else {
      if (wantsRolePatch && isOwnerRole(data.role)) {
        throw new Error('Không cấp role owner qua màn quản lý user.');
      }
      if (wantsBalancePatch) {
        if (Object.prototype.hasOwnProperty.call(data, 'balance')) {
          data.balance = Math.max(0, Math.round(toNumber(data.balance, 0)));
        }
        if (Object.prototype.hasOwnProperty.call(data, 'game_balance')) {
          data.game_balance = Math.max(0, Math.round(toNumber(data.game_balance, 0)));
        }
      }
    }
  }

  if (resource === 'smm-services') {
    const current = await db.smm_services_cache.findUnique({
      where: { id },
      select: { server_info: true },
    }).catch(() => null);
    data = normalizeSmmServicePatch(data, current?.server_info);
  }

  if (resource === 'automxh-variants') {
    data = normalizeAutoMxhVariantPatch(data);
  }

  data = normalizePrismaPayload(config, data);

  if (resource === 'smm-orders' && typeof data.status === 'string') {
    const requestedStatus = String(data.status || '').trim().toLowerCase();
    if (['refunded', 'refund'].includes(requestedStatus)) {
      return cancelAndRefundSmmOrder(id, adminId, req, data);
    }
    data.status = normalizeSmmStatus(data.status);
  }

  if (resource === 'automxh-orders' && typeof data.status === 'string') {
    const requestedStatus = String(data.status || '').trim().toLowerCase();
    if (['refunded', 'refund'].includes(requestedStatus)) {
      return refundAutoMxhOrder(id, adminId, req, data);
    }
    await ensureAutoMxhOrderStatusColumn();
    data.status = normalizeAutoMxhOrderStatus(data.status);
  }

  if ((resource === 'forum-threads' || resource === 'forum-posts') && typeof data.status === 'string') {
    data.status = normalizeForumModerationStatus(data.status);
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

  if (resource === 'kenh-tiktok-settings') {
    await invalidateKenhGiaReSettingsCache();
  }

  if (
    resource === 'tiktok-channel-products' &&
    !Object.prototype.hasOwnProperty.call(data, 'sale_price_vnd') &&
    (
      Object.prototype.hasOwnProperty.call(data, 'margin_percent') ||
      Object.prototype.hasOwnProperty.call(data, 'is_auto_price') ||
      Object.prototype.hasOwnProperty.call(data, 'api_price_vnd')
    )
  ) {
    updated = await updateTikTokChannelProductAutoPrice(id) || updated;
  }

  if (resource === 'smm-services') {
    clearSmmServicesCache();
  }

  if (resource === 'forum-threads' && typeof data.status === 'string') {
    await syncForumThreadStatusAfterAdminPatch(id, String(data.status), req, adminId);
  }

  if (resource === 'forum-posts' && typeof data.status === 'string') {
    await syncForumPostStatusAfterAdminPatch(id, String(data.status), req, adminId);
  }

  if (resource === 'users' && previousUserSnapshot) {
    const balanceChanges: string[] = [];
    if (Object.prototype.hasOwnProperty.call(data, 'balance')) {
      balanceChanges.push(`ví chính ${toNumber(previousUserSnapshot.balance, 0).toLocaleString('vi-VN')}đ -> ${toNumber(data.balance, 0).toLocaleString('vi-VN')}đ`);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'game_balance')) {
      balanceChanges.push(`ví game ${toNumber(previousUserSnapshot.game_balance, 0).toLocaleString('vi-VN')}đ -> ${toNumber(data.game_balance, 0).toLocaleString('vi-VN')}đ`);
    }
    if (balanceChanges.length > 0) {
      await db.activity_logs.create({
        data: {
          user_id: id,
          activity: `Owner #${adminId} cập nhật số dư tài khoản ${previousUserSnapshot.username || `#${id}`}: ${balanceChanges.join(', ')}`,
          user_agent: req.headers.get('user-agent') || null,
        },
      }).catch(() => undefined);
    }
  }

  await logAdminAction({ adminId, action: `update ${resource}`, target: `#${id}`, req });
  return { success: true, data: normalizeValue(updated) };
}

async function cancelAndRefundSmmOrder(
  id: number,
  adminId: number,
  req: NextRequest,
  patch: Record<string, unknown>
) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.smm_orders.findUnique({ where: { id } });
    if (!order) {
      throw new Error('Không tìm thấy đơn SMM');
    }

    const alreadyRefunded =
      Boolean(order.is_refunded) ||
      toNumber(order.refund_amount, 0) > 0 ||
      ['refund', 'refunded'].includes(String(order.status || '').trim().toLowerCase());

    const normalizedStatus = normalizeSmmStatus(String(patch.status || 'Refunded').trim() || 'Refunded');
    const reason = typeof patch.reason === 'string' ? patch.reason.trim() : '';

    if (alreadyRefunded) {
      const updatedOrder = await tx.smm_orders.update({
        where: { id },
        data: {
          status: normalizedStatus,
          reason: reason || order.reason || `Canceled by admin #${adminId}`,
        },
      });
      return updatedOrder;
    }

    const settings = await getLegacySettingsMap();
    const vatPercent = getVatPercent(settings);
    const subtotal = toNumber(order.price, 0);
    const refundAmount = Math.round(subtotal + (subtotal * vatPercent) / 100);

    if (refundAmount <= 0) {
      const updatedOrder = await tx.smm_orders.update({
        where: { id },
        data: {
          status: normalizedStatus,
          reason: reason || order.reason || `Refunded by admin #${adminId}`,
        },
      });
      return updatedOrder;
    }

    const locked = await tx.smm_orders.updateMany({
      where: {
        id,
        OR: [{ is_refunded: false }, { is_refunded: null }],
        AND: [
          {
            OR: [
              { refund_amount: null },
              { refund_amount: { lte: 0 } },
            ],
          },
        ],
      },
      data: {
        status: normalizedStatus,
        reason: reason || `Refunded by admin #${adminId}`,
        is_refunded: true,
        refund_amount: refundAmount,
      },
    });

    if (locked.count === 0) {
      const updatedOrder = await tx.smm_orders.findUnique({ where: { id } });
      return updatedOrder || order;
    }

    const updatedUser = await tx.users.update({
      where: { id: order.user_id },
      data: {
        balance: { increment: refundAmount },
        last_activity: new Date(),
      },
      select: { balance: true },
    });
    const nextBalance = toNumber(updatedUser.balance, 0);

    const updatedOrder = await tx.smm_orders.findUnique({
      where: { id },
    });

    await tx.transactions.create({
      data: {
        user_id: order.user_id,
        amount: refundAmount,
        balance_after: nextBalance,
        type: 'refund',
        status: 'success',
        content: `Hoàn tiền đơn SMM #${id} do admin chọn Hoàn tiền`,
      },
    }).catch(() => undefined);

    await tx.activity_logs.create({
      data: {
        user_id: order.user_id,
        activity: `Hoàn tiền đơn SMM #${id}: +${refundAmount}`,
        user_agent: `admin_refund_${adminId}`,
      },
    }).catch(() => undefined);

    return updatedOrder || order;
  });

  await logAdminAction({ adminId, action: 'cancel refund smm order', target: `#${id}`, req });
  return { success: true, data: normalizeValue(result) };
}

async function refundAutoMxhOrder(
  id: number,
  adminId: number,
  req: NextRequest,
  patch: Record<string, unknown>
) {
  const orderColumns = await ensureAutoMxhRefundColumns();

  const result = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT * FROM `automxh_orders` WHERE id = ? LIMIT 1 FOR UPDATE',
      id
    );
    const order = rows[0];
    if (!order) {
      throw new Error('Không tìm thấy đơn Auto MXH');
    }

    const currentStatus = String(order.status || '').trim().toLowerCase();
    const alreadyRefunded =
      isAutoMxhRefundedStatus(currentStatus) ||
      Boolean(toNumber(order.is_refunded, 0)) ||
      toNumber(order.refund_amount, 0) > 0;

    const normalizedStatus = normalizeAutoMxhOrderStatus(patch.status || 'refunded', 'refunded');
    const reason = typeof patch.reason === 'string' ? patch.reason.trim() : '';

    if (alreadyRefunded) {
      await updateAutoMxhOrderPatch(tx, id, orderColumns, {
        status: normalizedStatus,
        updated_at: new Date(),
        ...(reason ? { reason } : {}),
      });
      const updatedRows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT * FROM `automxh_orders` WHERE id = ? LIMIT 1',
        id
      );
      return updatedRows[0] || order;
    }

    const refundAmount = Math.max(
      toNumber(order.amount, 0),
      toNumber(order.price, 0),
    );

    const user = await tx.users.findUnique({
      where: { id: Number(order.user_id || 0) },
      select: { balance: true },
    });

    if (!user) {
      throw new Error('Không tìm thấy user của đơn Auto MXH');
    }

    await updateAutoMxhOrderPatch(tx, id, orderColumns, {
      status: normalizedStatus,
      updated_at: new Date(),
      refund_amount: refundAmount,
      is_refunded: 1,
      reason: reason || `Refunded by admin #${adminId}`,
    });

    const updatedUser = await tx.users.update({
      where: { id: Number(order.user_id || 0) },
      data: {
        balance: { increment: refundAmount },
        last_activity: new Date(),
      },
      select: { balance: true },
    });
    const nextBalance = toNumber(updatedUser.balance, 0);

    await tx.transactions.create({
      data: {
        user_id: Number(order.user_id || 0),
        amount: refundAmount,
        balance_after: nextBalance,
        type: 'refund',
        status: 'success',
        content: `Hoàn tiền đơn Auto MXH #${id} do admin chọn Hoàn tiền`,
      },
    }).catch(() => undefined);

    await tx.activity_logs.create({
      data: {
        user_id: Number(order.user_id || 0),
        activity: `Hoàn tiền đơn Auto MXH #${id}: +${refundAmount}`,
        user_agent: `admin_refund_${adminId}`,
      },
    }).catch(() => undefined);

    const updatedRows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT * FROM `automxh_orders` WHERE id = ? LIMIT 1',
      id
    );
    return updatedRows[0] || order;
  });

  await logAdminAction({ adminId, action: 'refund automxh order', target: `#${id}`, req });
  return { success: true, data: normalizeValue(result) };
}

export async function deleteAdminResource(resource: string, id: number, adminId: number, req: NextRequest) {
  const config = getConfig(resource);
  if (config.readonly) {
    throw new Error('Resource chỉ đọc');
  }

  if (resource === 'users') {
    const target = await db.users.findUnique({
      where: { id },
      select: { role: true },
    }).catch(() => null);
    if (String(target?.role || '').toLowerCase() === 'owner') {
      throw new Error('Không thể khóa/xóa tài khoản owner qua màn quản lý user.');
    }

    const userColumns = getCachedPrismaModelFields('users');
    const data: Record<string, unknown> = {
      status: 'banned',
      lock_reason: 'Admin delete action',
      locked_at: new Date(),
    };
    if (userColumns.has('is_deleted')) {
      data.is_deleted = true;
    }

    const updated = await db.users.update({
      where: { id },
      data,
    });
    await logAdminAction({ adminId, action: 'delete user', target: `#${id}`, req });
    return { success: true, data: normalizeValue(updated) };
  }

  if (resource === 'smm-services') {
    const updated = await db.smm_services_cache.update({
      where: { id },
      data: { is_deleted: true, status: 'inactive' },
    });
    clearSmmServicesCache();
    await logAdminAction({ adminId, action: 'soft delete smm service', target: `#${id}`, req });
    return { success: true, data: normalizeValue(updated) };
  }

  if (resource === 'deposits') {
    const deposit = await db.transactions.findFirst({
      where: { id, type: 'deposit' },
      select: { id: true, status: true },
    });
    if (!deposit) {
      throw new Error('Không tìm thấy giao dịch nạp tiền');
    }

    const normalizedStatus = String(deposit.status || '').trim().toLowerCase();
    if (normalizedStatus === 'success') {
      const updated = await db.transactions.update({
        where: { id },
        data: { status: 'failed' },
      });
      await logAdminAction({ adminId, action: 'mark deposit failed', target: `#${id}`, req });
      return { success: true, data: normalizeValue(updated) };
    }

    await db.transactions.delete({ where: { id } });
    await logAdminAction({ adminId, action: 'delete deposit', target: `#${id}`, req });
    return { success: true };
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

  if (resource === 'kenh-tiktok-settings') {
    await invalidateKenhGiaReSettingsCache();
  }

  await logAdminAction({ adminId, action: `delete ${resource}`, target: `#${id}`, req });
  return { success: true };
}

export async function getAdminResourceDetail(resource: string, id: number) {
  if (!id) {
    throw new Error('Thiếu ID dữ liệu');
  }

  if (resource !== 'users') {
    throw new Error('Resource chưa hỗ trợ xem chi tiết');
  }

  const user = await db.users.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      fullname: true,
      role: true,
      status: true,
      balance: true,
      game_balance: true,
      rank: true,
      last_ip: true,
      last_login: true,
      lock_reason: true,
      locked_at: true,
      locked_until: true,
      is_blue_tick: true,
      telegram_id: true,
      telegram_username: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!user) {
    throw new Error('Không tìm thấy user');
  }

  const [hasSmmOrdersTable, hasAutomxhOrdersTable, hasAdminAuditLogsTable, hasAdminPrivateMessagesTable] = await Promise.all([
    tableExists('smm_orders'),
    tableExists('automxh_orders'),
    tableExists('admin_audit_logs'),
    tableExists('admin_private_messages'),
  ]);

  const [activityHistory, recentTransactions, smmOrders, automxhOrders, auditLogs, privateMessages] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT id, activity, ip_address, user_agent, created_at
        FROM activity_logs
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 25
      `,
      id
    ).catch(() => []),
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT id, type, amount, balance_after, status, content, created_at
        FROM transactions
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 15
      `,
      id
    ).catch(() => []),
    hasSmmOrdersTable
      ? db.$queryRawUnsafe<Record<string, unknown>[]>(
          `
            SELECT id, service_name, quantity, price, status, created_at
            FROM smm_orders
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 10
          `,
          id
        ).catch(() => [])
      : Promise.resolve([]),
    hasAutomxhOrdersTable
      ? db.$queryRawUnsafe<Record<string, unknown>[]>(
          `
            SELECT id, title, amount, status, created_at
            FROM automxh_orders
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 10
          `,
          id
        ).catch(() => [])
      : Promise.resolve([]),
    hasAdminAuditLogsTable
      ? db.$queryRawUnsafe<Record<string, unknown>[]>(
          `
            SELECT id, action, description, created_at
            FROM admin_audit_logs
            WHERE target_user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 12
          `,
          id
        ).catch(() => [])
      : Promise.resolve([]),
    hasAdminPrivateMessagesTable
      ? db.$queryRawUnsafe<Record<string, unknown>[]>(
          `
            SELECT id, message, show_limit, shown_count, status, created_at
            FROM admin_private_messages
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 12
          `,
          id
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  const stats = {
    activity_count: activityHistory.length,
    transaction_count: recentTransactions.length,
    smm_order_count: smmOrders.length,
    automxh_order_count: automxhOrders.length,
    total_deposit: recentTransactions
      .filter((row) => String(row.type || '').trim() === 'deposit')
      .reduce((sum, row) => sum + toNumber(row.amount, 0), 0),
    total_refund: recentTransactions
      .filter((row) => String(row.type || '').trim() === 'refund')
      .reduce((sum, row) => sum + toNumber(row.amount, 0), 0),
  };

  return {
    success: true,
    data: normalizeValue(user),
    meta: {
      stats: normalizeValue(stats),
      activity_history: normalizeValue(activityHistory),
      recent_transactions: normalizeValue(recentTransactions),
      smm_orders: normalizeValue(smmOrders),
      automxh_orders: normalizeValue(automxhOrders),
      audit_logs: normalizeValue(auditLogs),
      private_messages: normalizeValue(privateMessages),
    },
  };
}

async function setSmmServicesMarginPercent(
  input: Record<string, unknown>,
  ids: number[],
  adminId: number,
  req: NextRequest
) {
  const percent = toNumber(input.percent, Number.NaN);
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error('Phần trăm lãi không hợp lệ');
  }

  const table = 'smm_services_cache';
  const columns = await getRawTableColumns(table);
  if (!columns.has('rate') || !columns.has('custom_price')) {
    throw new Error('Bảng SMM thiếu cột rate/custom_price để tính giá bán');
  }

  const scope = String(input.scope || '').trim();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (columns.has('is_deleted')) {
    conditions.push('COALESCE(`is_deleted`, 0) = 0');
  }

  if (ids.length > 0 && (scope === 'single' || scope === 'selected')) {
    conditions.push(`id IN (${ids.map(() => '?').join(', ')})`);
    values.push(...ids);
  } else if (scope === 'filtered') {
    const search = String(input.search || '').trim();
    const status = String(input.status || '').trim();
    const providerId = Math.max(0, Math.trunc(toNumber(input.provider_id, 0)));
    const category = String(input.category || '').trim();

    if (search) {
      const like = `%${search}%`;
      conditions.push(`(
        \`name\` LIKE ?
        OR COALESCE(\`original_name\`, '') LIKE ?
        OR COALESCE(\`category\`, '') LIKE ?
        OR COALESCE(\`type\`, '') LIKE ?
        OR CAST(\`service_id\` AS CHAR) LIKE ?
        OR CAST(\`provider_id\` AS CHAR) LIKE ?
      )`);
      values.push(like, like, like, like, like, like);
    }

    if (status && columns.has('status')) {
      conditions.push('COALESCE(`status`, \'active\') = ?');
      values.push(status);
    }

    if (providerId > 0 && columns.has('provider_id')) {
      conditions.push('`provider_id` = ?');
      values.push(providerId);
    }

    if (category && columns.has('category')) {
      conditions.push('(`category` = ? OR `category` LIKE ?)');
      values.push(category, `${category}%`);
    }
  } else if (scope === 'provider') {
    const providerId = Math.max(0, Math.trunc(toNumber(input.provider_id, 0)));
    const providerName = String(input.provider_name || '').trim();

    if (!columns.has('provider_id')) {
      throw new Error('Bảng SMM thiếu provider_id để lọc nguồn');
    }

    if (providerId > 0) {
      conditions.push('`provider_id` = ?');
      values.push(providerId);
    } else if (providerName) {
      conditions.push(`EXISTS (
        SELECT 1
        FROM api_providers ap
        WHERE ap.id = \`${table}\`.\`provider_id\`
          AND LOWER(ap.name) LIKE LOWER(?)
      )`);
      values.push(`%${providerName}%`);
    } else {
      throw new Error('Chọn nguồn SMM trước khi áp dụng theo provider');
    }
  } else if (scope !== 'all') {
    throw new Error('Chọn phạm vi chỉnh % lãi hợp lệ');
  }

  const setSqlParts = [
    `\`custom_price\` = ${buildSmmSafeMarginPriceSql('`rate`')}`,
  ];
  const setValues: unknown[] = [percent];

  if (columns.has('margin_percent')) {
    setSqlParts.push('`margin_percent` = ?');
    setValues.push(percent);
  }

  if (columns.has('is_auto_margin')) {
    setSqlParts.push('`is_auto_margin` = 1');
  }

  if (columns.has('cached_at')) {
    setSqlParts.push('`cached_at` = NOW()');
  } else if (columns.has('updated_at')) {
    setSqlParts.push('`updated_at` = NOW()');
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const affected = await db.$executeRawUnsafe(
    `UPDATE \`${table}\` SET ${setSqlParts.join(', ')} ${whereSql}`,
    ...setValues,
    ...values
  );

  clearSmmServicesCache();
  await logAdminAction({
    adminId,
    action: 'set smm margin percent',
    target: `${scope || 'all'} / ${percent}% / ${affected} services`,
    req,
  });

  return { success: true, affected };
}

function normalizeForumModerationStatus(status: string) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['active', 'approved', 'open', 'published'].includes(normalized)) return 'active';
  if (['reject', 'rejected'].includes(normalized)) return 'rejected';
  if (['delete', 'deleted'].includes(normalized)) return 'deleted';
  if (['hide', 'hidden'].includes(normalized)) return 'hidden';
  if (normalized === 'pending') return 'pending';
  return normalized || 'pending';
}

async function syncForumThreadStatusAfterAdminPatch(id: number, status: string, req: NextRequest, adminId: number) {
  const nextStatus = normalizeForumModerationStatus(status);

  if (!['active', 'rejected', 'pending', 'hidden', 'deleted'].includes(nextStatus)) return;

  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    'SELECT id, user_id, title FROM `forum_threads` WHERE id = ? LIMIT 1',
    id
  );
  const thread = rows[0];
  if (!thread) return;

  const firstPostRows = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>(
    'SELECT id FROM `forum_posts` WHERE thread_id = ? AND is_first_post = 1 ORDER BY id ASC LIMIT 1',
    id
  );
  const firstPostId = Number(firstPostRows[0]?.id || 0) || null;

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'UPDATE `forum_threads` SET status = ?, is_deleted = ?, updated_at = NOW(), last_post_id = COALESCE(?, last_post_id) WHERE id = ?',
      nextStatus,
      nextStatus === 'deleted' ? 1 : 0,
      firstPostId,
      id
    );
    await tx.$executeRawUnsafe(
      'UPDATE `forum_posts` SET status = ?, is_deleted = ?, updated_at = NOW() WHERE thread_id = ? AND is_first_post = 1',
      nextStatus,
      nextStatus === 'deleted' ? 1 : 0,
      id
    );
  });

  if (nextStatus === 'active' || nextStatus === 'rejected') {
    await notifyModerationUser({
      userId: Number(thread.user_id || 0),
      adminId,
      type: nextStatus === 'active' ? 'forum_thread_approved' : 'forum_thread_rejected',
      message: nextStatus === 'active'
        ? `Thread của bạn đã được duyệt: ${String(thread.title || `#${id}`)}`
        : `Thread của bạn đã bị từ chối: ${String(thread.title || `#${id}`)}`,
      link: nextStatus === 'active' ? `/user/forum/thread/${id}` : '/user/forum/my-threads',
    });
    await logAdminAction({ adminId, action: `sync forum thread ${nextStatus}`, target: `#${id}`, req });
  }
}

async function syncForumPostStatusAfterAdminPatch(id: number, status: string, req: NextRequest, adminId: number) {
  const nextStatus = normalizeForumModerationStatus(status);

  if (!['active', 'rejected', 'pending', 'hidden', 'deleted'].includes(nextStatus)) return;

  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT p.id, p.thread_id, p.user_id, p.is_first_post, t.title, t.user_id AS thread_owner_id
      FROM forum_posts p
      LEFT JOIN forum_threads t ON t.id = p.thread_id
      WHERE p.id = ?
      LIMIT 1
    `,
    id
  );
  const post = rows[0];
  if (!post) return;

  const threadId = Number(post.thread_id || 0);
  const postUserId = Number(post.user_id || 0);
  const threadOwnerId = Number(post.thread_owner_id || 0);
  const isFirstPost = Number(post.is_first_post || 0) === 1;

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'UPDATE `forum_posts` SET status = ?, is_deleted = ?, updated_at = NOW() WHERE id = ?',
      nextStatus,
      nextStatus === 'deleted' ? 1 : 0,
      id
    );

    if (isFirstPost) {
      await tx.$executeRawUnsafe(
        'UPDATE `forum_threads` SET status = ?, is_deleted = ?, updated_at = NOW(), last_post_id = ? WHERE id = ?',
        nextStatus,
        nextStatus === 'deleted' ? 1 : 0,
        id,
        threadId
      );
    } else if (nextStatus === 'active') {
      await tx.$executeRawUnsafe(
        'UPDATE `forum_threads` SET updated_at = NOW(), last_post_id = ? WHERE id = ?',
        id,
        threadId
      );
    }
  });

  if (nextStatus === 'active' || nextStatus === 'rejected') {
    await notifyModerationUser({
      userId: postUserId,
      adminId,
      type: nextStatus === 'active' ? 'forum_post_approved' : 'forum_post_rejected',
      message: nextStatus === 'active'
        ? `Bài viết của bạn đã được duyệt trong thread: ${String(post.title || `#${threadId}`)}`
        : `Bài viết của bạn đã bị từ chối trong thread: ${String(post.title || `#${threadId}`)}`,
      link: nextStatus === 'active' ? `/user/forum/thread/${threadId}#post-${id}` : '/user/forum/posts',
    });

    if (nextStatus === 'active' && !isFirstPost && threadOwnerId && threadOwnerId !== postUserId) {
      await notifyModerationUser({
        userId: threadOwnerId,
        adminId,
        type: 'reply',
        message: `Có phản hồi mới đã được duyệt trong chủ đề của bạn: ${String(post.title || `#${threadId}`)}`,
        link: `/user/forum/thread/${threadId}#post-${id}`,
      });
    }
    await logAdminAction({ adminId, action: `sync forum post ${nextStatus}`, target: `#${id}`, req });
  }
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

  if (resource === 'smm-services' && action === 'toggle-category') {
    const category = String(input.category || '').trim();
    const nextStatus = String(input.status || '').trim().toLowerCase() === 'active' ? 'active' : 'inactive';
    const providerId = Math.max(0, Math.trunc(toNumber(input.provider_id, 0)));
    if (!category) {
      throw new Error('Thiếu danh mục SMM cần tắt/bật');
    }

    const result = await db.smm_services_cache.updateMany({
      where: {
        category,
        is_deleted: false,
        ...(providerId > 0 ? { provider_id: providerId } : {}),
      },
      data: {
        status: nextStatus,
        is_deleted: false,
      },
    });
    clearSmmServicesCache();
    await logAdminAction({
      adminId,
      action: `${nextStatus === 'active' ? 'enable' : 'disable'} smm category`,
      target: providerId > 0 ? `${category} / provider #${providerId}` : category,
      req,
    });
    return { success: true, affected: result.count };
  }

  if (resource === 'smm-services' && action === 'set-margin-percent') {
    return setSmmServicesMarginPercent(input, ids, adminId, req);
  }

  const moderationAction = action.replace(/^bulk-/, '');
  if (
    (resource === 'forum-threads' || resource === 'forum-posts' || resource === 'find-jobs' || resource === 'game-items') &&
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
      } else if (resource === 'game-items') {
        results.push(await moderateGameItem(targetId, approved, adminId, req));
      } else {
        results.push(await moderateFindJob(targetId, approved, adminId, req));
      }
    }

    return { success: true, affected: results.length, data: normalizeValue(results) };
  }

  if ((resource === 'forum-threads' || resource === 'find-jobs' || resource === 'game-items') && (action === 'pin' || action === 'unpin')) {
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

    if (resource === 'game-items') {
      await db.$executeRawUnsafe(
        'UPDATE `game_market_items` SET `is_pinned` = ?, `pinned_until` = ?, `updated_at` = NOW() WHERE id = ?',
        pinned ? 1 : 0,
        pinned ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
        id
      );
      const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
        'SELECT * FROM `game_market_items` WHERE id = ? LIMIT 1',
        id
      );
      await logAdminAction({ adminId, action: pinned ? 'pin game item' : 'unpin game item', target: `#${id}`, req });
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
      const { syncSmmApiPricesFromProvider } = await import('@/lib/smm-provider');
      const providerId = Math.max(0, Math.trunc(toNumber(input.provider_id, 0)));
      const result = await syncSmmApiPricesFromProvider(providerId || undefined);
      await logAdminAction({
        adminId,
        action: 'sync smm api prices',
        target: `${result.providerName} / ${result.fetched} fetched / ${result.changed} changed / keep custom price`,
        req,
      });
      return { success: true, data: normalizeValue(result), count: result.fetched };
    }

    if (resource === 'providers') {
      const providers = await db.api_providers.updateMany({
        data: { last_sync: new Date(), health_status: 'online' },
      });
      return { success: true, affected: providers.count };
    }
  }

  if (resource === 'smm-services' && action === 'sync-api-price') {
    const { syncSmmApiPricesFromProvider } = await import('@/lib/smm-provider');
    const providerId = Math.max(0, Math.trunc(toNumber(input.provider_id, 0)));
    const result = await syncSmmApiPricesFromProvider(providerId || undefined);
    await logAdminAction({
      adminId,
      action: 'sync smm api prices',
      target: `${result.providerName} / ${result.fetched} fetched / ${result.changed} changed / keep custom price`,
      req,
    });
    return { success: true, data: normalizeValue(result), count: result.fetched };
  }

  if (resource === 'tiktok-channel-products' && action === 'sync-kenhgiare') {
    const result = await syncKenhGiaReProducts();
    await logAdminAction({
      adminId,
      action: 'sync kenhgiare tiktok channels',
      target: `${result.fetched} fetched / ${result.upserted} upserted / ${result.repriced} auto repriced at ${result.auto_margin_percent}%`,
      req,
    });
    return { success: true, data: normalizeValue(result), count: result.fetched };
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
    const pending = await db.transactions.count({ where: { type: 'deposit', status: { in: ['pending', 'processing'] } } });
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
    `
      SELECT t.id, t.user_id, t.title, t.status, p.content
      FROM forum_threads t
      LEFT JOIN forum_posts p
        ON p.id = (
          SELECT fp.id
          FROM forum_posts fp
          WHERE fp.thread_id = t.id
            AND fp.is_first_post = 1
          ORDER BY fp.id ASC
          LIMIT 1
        )
      WHERE t.id = ?
      LIMIT 1
    `,
    id
  );
  const thread = rows[0];
  if (!thread) throw new Error(`Không tìm thấy thread #${id}`);
  if (approved && containsForumGamblingContent(buildForumModerationText({ title: thread.title, content: thread.content }))) {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'UPDATE forum_threads SET status = ?, is_deleted = 0, updated_at = NOW() WHERE id = ?',
        'rejected',
        id
      );
      await tx.$executeRawUnsafe(
        'UPDATE forum_posts SET status = ?, is_deleted = 0, updated_at = NOW() WHERE thread_id = ? AND is_first_post = 1',
        'rejected',
        id
      );
    });
    await notifyModerationUser({
      userId: Number(thread.user_id || 0),
      adminId,
      type: 'forum_thread_rejected',
      message: `Thread của bạn đã bị từ chối vì nội dung cờ bạc/cá cược: ${String(thread.title || `#${id}`)}`,
      link: '/user/forum/my-threads',
    });
    await logAdminAction({ adminId, action: 'reject gambling forum thread', target: `#${id}`, req });
    throw new Error(`Thread #${id} chứa nội dung cờ bạc/cá cược nên đã bị từ chối`);
  }

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
      SELECT p.id, p.thread_id, p.user_id, p.is_first_post, p.content, p.status, t.title, t.user_id AS thread_owner_id
      FROM forum_posts p
      LEFT JOIN forum_threads t ON t.id = p.thread_id
      WHERE p.id = ?
      LIMIT 1
    `,
    id
  );
  const post = rows[0];
  if (!post) throw new Error(`Không tìm thấy post #${id}`);
  if (approved && containsForumGamblingContent(buildForumModerationText({ title: post.title, content: post.content }))) {
    await db.$executeRawUnsafe(
      'UPDATE forum_posts SET status = ?, is_deleted = 0, updated_at = NOW() WHERE id = ?',
      'rejected',
      id
    );
    await notifyModerationUser({
      userId: Number(post.user_id || 0),
      adminId,
      type: 'forum_post_rejected',
      message: `Bài viết của bạn đã bị từ chối vì nội dung cờ bạc/cá cược trong thread: ${String(post.title || `#${post.thread_id || 0}`)}`,
      link: '/user/forum/posts',
    });
    await logAdminAction({ adminId, action: 'reject gambling forum post', target: `#${id}`, req });
    throw new Error(`Post #${id} chứa nội dung cờ bạc/cá cược nên đã bị từ chối`);
  }

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
    status: approved ? 'open' : 'closed',
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
  return updated[0] || { id, status: approved ? 'open' : 'closed', approval_status: approved ? 'approved' : 'rejected' };
}

async function moderateGameItem(id: number, approved: boolean, adminId: number, req: NextRequest) {
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    'SELECT * FROM `game_market_items` WHERE id = ? LIMIT 1',
    id
  );
  const item = rows[0];
  if (!item) {
    throw new Error(`Không tìm thấy bài game-market #${id}`);
  }

  const ownerId = Number(item.seller_id || 0);
  const nextStatus = approved ? 'selling' : await getGameMarketRejectedLikeStatus();

  await db.$executeRawUnsafe(
    `
      UPDATE game_market_items
      SET status = ?,
          is_pinned = CASE WHEN ? = 1 THEN is_pinned ELSE 0 END,
          pinned_until = CASE WHEN ? = 1 THEN pinned_until ELSE NULL END,
          updated_at = NOW()
      WHERE id = ?
    `,
    nextStatus,
    approved ? 1 : 0,
    approved ? 1 : 0,
    id
  );

  await notifyModerationUser({
    userId: ownerId,
    adminId,
    type: approved ? 'game_item_approved' : 'game_item_rejected',
    message: approved
      ? `Bài đăng game của bạn đã được duyệt: ${String(item.title || `#${id}`)}`
      : `Bài đăng game của bạn đã bị từ chối: ${String(item.title || `#${id}`)}`,
    link: approved ? `/user/game-market/${id}` : `/user/game-market/edit/${id}`,
  });
  await logAdminAction({ adminId, action: approved ? 'approve game item' : 'reject game item', target: `#${id}`, req });

  const updated = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    'SELECT * FROM `game_market_items` WHERE id = ? LIMIT 1',
    id
  );
  return updated[0] || { id, status: nextStatus };
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
      await sendSecurityAlertEmail({
        event: 'ADMIN_IP_BAN',
        title: 'Admin đã khóa IP thủ công',
        severity: 'HIGH',
        ip,
        userId: adminId,
        reason,
        path: req.nextUrl.pathname,
        method: req.method,
        userAgent: req.headers.get('user-agent') || null,
        cooldownKey: `admin-ip-ban:${ip}:${adminId}`,
      }).catch(() => undefined);
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
          role: { notIn: ['admin', 'owner'] },
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
          role: { notIn: ['admin', 'owner'] },
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
  const deposit = await db.transactions.findUnique({ where: { id } });
  if (!deposit || deposit.type !== 'deposit') {
    throw new Error('Không tìm thấy giao dịch nạp');
  }

  if (deposit.status === 'success' || deposit.status === 'failed') {
    return deposit;
  }

  if (!approve) {
    const rejected = await db.transactions.update({
      where: { id },
      data: { status: 'failed', content: `${deposit.content || ''} | Rejected by admin #${adminId}` },
    });
    await logAdminAction({ adminId, action: 'reject deposit', target: `#${id}`, req });
    return rejected;
  }

  const result = await approveDepositById(id, 'admin');
  if (result.state !== 'processed' && result.state !== 'already_processed') {
    throw new Error(`Không thể duyệt giao dịch nạp: ${result.state}`);
  }

  const updated = await db.transactions.findUnique({ where: { id } });
  await logAdminAction({
    adminId,
    action: `approve ${result.state === 'processed' ? result.wallet : 'deposit'} deposit`,
    target: `#${id}`,
    req,
  });
  return updated || deposit;
}

async function refundCardOrder(id: number, adminId: number, req: NextRequest) {
  if (!(await tableExists('card_orders'))) {
    throw new Error('Bảng card_orders chưa tồn tại trong cơ sở dữ liệu hiện tại');
  }

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
  const payload = { ...data };
  const columnsInTable = await getRawTableColumns(table);
  if ((table === 'press_publications' || table === 'press_orders') && columnsInTable.has('created_at') && payload.created_at === undefined) {
    payload.created_at = getUtcDatabaseDateTime();
  }
  if ((table === 'web_service_packages' || table === 'web_service_orders') && columnsInTable.has('created_at') && payload.created_at === undefined) {
    payload.created_at = getVietnamDatabaseDateTime();
  }
  const filteredData = await normalizeRawTablePayload(table, await filterRawTableData(table, payload));
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
  const filteredData = await normalizeRawTablePayload(table, await filterRawTableData(table, data));
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
  if (table === 'forum_threads') {
    await db.$executeRawUnsafe(
      'UPDATE `forum_threads` SET `status` = ?, `is_deleted` = 1, `updated_at` = NOW() WHERE id = ?',
      'deleted',
      id
    );
    await db.$executeRawUnsafe(
      'UPDATE `forum_posts` SET `status` = ?, `is_deleted` = 1, `updated_at` = NOW() WHERE thread_id = ?',
      'deleted',
      id
    ).catch(() => undefined);
    return;
  }
  if (table === 'forum_posts') {
    await db.$executeRawUnsafe(
      'UPDATE `forum_posts` SET `status` = ?, `is_deleted` = 1, `updated_at` = NOW() WHERE id = ?',
      'deleted',
      id
    );
    return;
  }
  await db.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE id = ?`, id);
}

async function getActualRawTable(config: ResourceConfig) {
  if (config.table === 'find_jobs') {
    return resolveFindJobTable();
  }

  if (config.table === 'meta_support_orders') {
    await ensureMetaSupportOrdersTable();
  }

  if (config.table === 'vibe_code_packages' || config.table === 'vibe_code_orders') {
    await ensureVibeCodeTables();
  }

  if (config.table === 'press_publications' || config.table === 'press_orders') {
    await ensurePressServiceTables();
  }

  if (config.table === 'web_service_packages' || config.table === 'web_service_orders') {
    await ensureWebServiceTables();
  }

  if (config.table === 'tiktok_channel_products' || config.table === 'tiktok_channel_orders') {
    await ensureTikTokChannelTables();
  }

  if (config.table === 'settings' && config.title === 'Cấu hình Kênh Giá Rẻ') {
    await ensureTikTokChannelTables();
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
