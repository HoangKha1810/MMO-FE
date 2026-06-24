import 'server-only';

import { db } from '@/lib/db';
import { getVietnamDatabaseDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { buildLegacyAssetUrl, getLegacySetting } from '@/lib/legacy-settings';
import { getLegacyEnv } from '@/lib/legacy-env';

interface SupportMessageRow {
  id: number;
  user_id: number;
  order_id?: number | null;
  support_category?: string | null;
  sender_type: 'user' | 'support';
  message: string | null;
  image_url: string | null;
  image_urls: string | null;
  created_at: Date | string;
  order_tiktok_id?: string | null;
  order_service_name?: string | null;
  order_status?: string | null;
}

interface ConversationRow {
  user_id: number;
  username: string | null;
  avatar: string | null;
  order_id: number | null;
  tiktok_id: string | null;
  service_name: string | null;
  order_status: string | null;
  last_message: string | null;
  last_at: Date | string | null;
  last_sender_type: 'user' | 'support' | null;
}

interface SupportOrderAccessRow {
  id: number;
  user_id?: number | null;
  tiktok_id?: string | null;
  service_name?: string | null;
  status: string | null;
  ngay_het_han: Date | string | null;
}

export const SUPPORT_TIKTOK_ROLE = 'support_tiktok';

export function normalizeSupportTikTokRole(role?: string | null) {
  return String(role || '').trim().toLowerCase().replace(/-/g, '_');
}

export function isSupportTikTokStaffRole(role?: string | null) {
  return normalizeSupportTikTokRole(role) === SUPPORT_TIKTOK_ROLE;
}

function parseImageUrls(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    }
  } catch {
    return [];
  }

  return [];
}

function mapMessage(row: SupportMessageRow, supportUsername: string) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    order_id: row.order_id ? Number(row.order_id) : null,
    support_category: row.support_category || '',
    order_tiktok_id: row.order_tiktok_id || '',
    order_service_name: row.order_service_name || '',
    order_status: row.order_status || '',
    sender_type: row.sender_type,
    sender_name: row.sender_type === 'support' ? supportUsername : '',
    message: String(row.message || ''),
    image_url: row.image_url || '',
    image_urls: parseImageUrls(row.image_urls),
    created_at: serializeDatabaseDateTime(row.created_at) || getVietnamDatabaseDateTime(),
  };
}

function parseAllowedIps() {
  return getLegacyEnv('ADMIN_ALLOWED_IPS')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isIpAllowed(clientIp?: string) {
  const allowedIps = parseAllowedIps();

  if (allowedIps.length === 0 || !clientIp) {
    return true;
  }

  const normalizedIp = clientIp.replace(/^::ffff:/, '').trim();
  return allowedIps.includes(normalizedIp);
}

async function getSettingsMap(keys: string[]) {
  const rows = await db.settings.findMany({
    where: { setting_key: { in: keys } },
    select: {
      setting_key: true,
      setting_value: true,
    },
  }).catch(() => []);

  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.setting_key] = row.setting_value || '';
    return acc;
  }, {});
}

function getDefaultSupportSettings() {
  return {
    support_tiktok_chat_username: '',
    service_chat_support_tiktok_status: 'active',
    service_chat_support_tiktok_name: 'Chat Support Tiktok',
    service_chat_support_tiktok_desc: 'Hỗ trợ chat TikTok chuyên nghiệp',
  };
}

async function tableExists(tableName: string) {
  const rows = await db.$queryRawUnsafe<Array<{ table_name: string }>>(
    `
      SELECT TABLE_NAME AS table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
      LIMIT 1
    `,
    tableName
  );

  return rows.length > 0;
}

async function getTableColumns(tableName: string) {
  const rows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT COLUMN_NAME AS column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    tableName
  ).catch(() => []);

  return new Set(rows.map((row) => String(row.column_name)));
}

async function getTableIndexes(tableName: string) {
  const rows = await db.$queryRawUnsafe<Array<{ index_name: string }>>(
    `
      SELECT INDEX_NAME AS index_name
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    tableName
  ).catch(() => []);

  return new Set(rows.map((row) => String(row.index_name)));
}

export async function ensureSupportTikTokChatTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS support_tiktok_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      order_id BIGINT UNSIGNED NULL,
      support_category VARCHAR(120) NULL,
      sender_type VARCHAR(20) NOT NULL DEFAULT 'user',
      message TEXT NULL,
      image_url LONGTEXT NULL,
      image_urls LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_support_tiktok_messages_user_id (user_id, id),
      KEY idx_support_tiktok_messages_order_id (order_id),
      KEY idx_support_tiktok_messages_user_order (user_id, order_id, id),
      KEY idx_support_tiktok_messages_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const columns = await getTableColumns('support_tiktok_messages');
  const columnStatements = [
    !columns.has('sender_type') ? "ADD COLUMN sender_type VARCHAR(20) NOT NULL DEFAULT 'user' AFTER user_id" : '',
    !columns.has('order_id') ? 'ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER user_id' : '',
    !columns.has('support_category') ? 'ADD COLUMN support_category VARCHAR(120) NULL AFTER order_id' : '',
    !columns.has('message') ? 'ADD COLUMN message TEXT NULL AFTER sender_type' : '',
    !columns.has('image_url') ? 'ADD COLUMN image_url LONGTEXT NULL AFTER message' : '',
    !columns.has('image_urls') ? 'ADD COLUMN image_urls LONGTEXT NULL AFTER image_url' : '',
    !columns.has('created_at') ? 'ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER image_urls' : '',
  ].filter(Boolean);

  for (const statement of columnStatements) {
    await db.$executeRawUnsafe(`ALTER TABLE support_tiktok_messages ${statement}`).catch(() => undefined);
  }

  await db.$executeRawUnsafe('ALTER TABLE support_tiktok_messages MODIFY COLUMN image_url LONGTEXT NULL').catch(() => undefined);
  await db.$executeRawUnsafe('ALTER TABLE support_tiktok_messages MODIFY COLUMN image_urls LONGTEXT NULL').catch(() => undefined);
  await db.$executeRawUnsafe("ALTER TABLE support_tiktok_messages MODIFY COLUMN sender_type VARCHAR(20) NOT NULL DEFAULT 'user'").catch(() => undefined);

  const indexes = await getTableIndexes('support_tiktok_messages');
  if (!indexes.has('idx_support_tiktok_messages_user_id')) {
    await db.$executeRawUnsafe('CREATE INDEX idx_support_tiktok_messages_user_id ON support_tiktok_messages (user_id, id)').catch(() => undefined);
  }
  if (!indexes.has('idx_support_tiktok_messages_order_id')) {
    await db.$executeRawUnsafe('CREATE INDEX idx_support_tiktok_messages_order_id ON support_tiktok_messages (order_id)').catch(() => undefined);
  }
  if (!indexes.has('idx_support_tiktok_messages_user_order')) {
    await db.$executeRawUnsafe('CREATE INDEX idx_support_tiktok_messages_user_order ON support_tiktok_messages (user_id, order_id, id)').catch(() => undefined);
  }
  if (!indexes.has('idx_support_tiktok_messages_created_at')) {
    await db.$executeRawUnsafe('CREATE INDEX idx_support_tiktok_messages_created_at ON support_tiktok_messages (created_at)').catch(() => undefined);
  }
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function getSupportOrderAccess(userId: number, hasOrderTable: boolean) {
  if (!hasOrderTable) {
    return {
      hasUnlockedChat: false,
      chatBlockedReason: 'Module đơn Support TikTok chưa sẵn sàng.',
      latestOrderId: null,
      latestOrderStatus: null,
      latestOrderExpiresAt: null,
    };
  }

  const nowText = getVietnamDatabaseDateTime();
  const [latestRows, eligibleRows] = await Promise.all([
    db.$queryRawUnsafe<SupportOrderAccessRow[]>(
      `
        SELECT id, status, ngay_het_han
        FROM tiktok_support_orders
        WHERE user_id = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      userId
    ).catch(() => []),
    db.$queryRawUnsafe<SupportOrderAccessRow[]>(
      `
        SELECT id, status, ngay_het_han
        FROM tiktok_support_orders
        WHERE user_id = ?
          AND LOWER(COALESCE(status, '')) IN ('active', 'completed', 'processing', 'success')
          AND ngay_het_han IS NOT NULL
          AND ngay_het_han >= ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      userId,
      nowText
    ).catch(() => []),
  ]);

  const latestOrder = latestRows[0] || null;
  const latestStatus = String(latestOrder?.status || '').trim().toLowerCase();
  const latestExpiresAt = latestOrder?.ngay_het_han ? serializeDatabaseDateTime(latestOrder.ngay_het_han) : '';
  const notExpired = Boolean(latestExpiresAt && latestExpiresAt >= nowText);
  const hasUnlockedChat = eligibleRows.length > 0;

  let chatBlockedReason = '';
  if (!hasUnlockedChat) {
    if (!latestOrder) {
      chatBlockedReason = 'Mua hàng thành công rồi mới chat được.';
    } else if (!latestExpiresAt) {
      chatBlockedReason = 'Gói Support TikTok của bạn chưa có hạn dùng. Hãy gia hạn hoặc đợi nhân viên hỗ trợ TikTok duyệt.';
    } else if (!notExpired) {
      chatBlockedReason = 'Gói Support TikTok của bạn đã hết hạn. Hãy gia hạn hoặc mua lại để chat tiếp.';
    } else if (latestStatus === 'pending') {
      chatBlockedReason = 'Đơn Support TikTok của bạn chưa được kích hoạt. Khi mua thành công bạn mới chat được.';
    } else if (latestStatus === 'canceled' || latestStatus === 'cancelled') {
      chatBlockedReason = 'Đơn Support TikTok của bạn đã bị hủy. Hãy tạo đơn mới để mở chat.';
    } else {
      chatBlockedReason = 'Mua hàng thành công rồi mới chat được.';
    }
  }

  return {
    hasUnlockedChat,
    chatBlockedReason,
    latestOrderId: latestOrder ? Number(latestOrder.id) : null,
    latestOrderStatus: latestOrder?.status ? String(latestOrder.status) : null,
    latestOrderExpiresAt: latestExpiresAt || toIsoDate(latestOrder?.ngay_het_han),
  };
}

export async function getSupportTiktokContext(userId: number, clientIp?: string) {
  await ensureSupportTikTokChatTable().catch((error) => {
    console.error('[support-tiktok/chat-bootstrap]', error);
  });

  const [user, settingsResult, hasOrderTable, hasRegionServiceTable, hasMenuTable, hasChatTable] = await Promise.all([
    db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
      },
    }).catch(() => null),
    getSettingsMap([
      'support_tiktok_chat_username',
      'service_chat_support_tiktok_status',
      'service_chat_support_tiktok_name',
      'service_chat_support_tiktok_desc',
    ]).catch(() => getDefaultSupportSettings()),
    tableExists('tiktok_support_orders'),
    tableExists('tiktok_region_services'),
    tableExists('tiktok_service_menus'),
    tableExists('support_tiktok_messages'),
  ]);

  if (!user) {
    return null;
  }

  const settings = { ...getDefaultSupportSettings(), ...settingsResult };
  const role = String(user.role || 'member');
  const normalizedRole = normalizeSupportTikTokRole(role);
  const configuredSupportUsername = getLegacyEnv(
    'SUPPORT_TIKTOK_SUPPORT_USERNAME',
    getLegacySetting(settings, 'support_tiktok_chat_username', 'nguyenhatsptik')
  );
  const adminIpAllowed = isIpAllowed(clientIp);
  const isSupport = isSupportTikTokStaffRole(role);
  const isAdmin = normalizedRole === 'admin';
  const supportUsername = isSupport ? user.username : configuredSupportUsername;
  const maintenance = getLegacySetting(settings, 'service_chat_support_tiktok_status', 'active') === 'maintenance';
  const missingTables = [
    !hasChatTable ? 'support_tiktok_messages' : '',
    !hasOrderTable ? 'tiktok_support_orders' : '',
    !hasRegionServiceTable ? 'tiktok_region_services' : '',
    !hasMenuTable ? 'tiktok_service_menus' : '',
  ].filter(Boolean);
  const orderAccess = isSupport
    ? {
        hasUnlockedChat: true,
        chatBlockedReason: '',
        latestOrderId: null,
        latestOrderStatus: null,
        latestOrderExpiresAt: null,
      }
    : isAdmin
      ? {
          hasUnlockedChat: false,
          chatBlockedReason: 'Tài khoản admin không được chat Support TikTok. Hãy dùng tài khoản role support-tiktok.',
          latestOrderId: null,
          latestOrderStatus: null,
          latestOrderExpiresAt: null,
        }
    : await getSupportOrderAccess(user.id, hasOrderTable);

  return {
    userId: user.id,
    username: user.username,
    role,
    isSupport,
    isAdmin,
    adminIpAllowed,
    canAccess: !maintenance || isSupport,
    maintenance,
    serviceName: getLegacySetting(
      settings,
      'service_chat_support_tiktok_name',
      'Chat Support Tiktok'
    ),
    serviceDescription: getLegacySetting(
      settings,
      'service_chat_support_tiktok_desc',
      'Hỗ trợ chat TikTok chuyên nghiệp'
    ),
    supportUsername,
    chatModuleAvailable: hasChatTable,
    orderModuleAvailable: true,
    canUseChat: isSupport ? hasChatTable : !isAdmin && hasChatTable && orderAccess.hasUnlockedChat,
    chatBlockedReason: orderAccess.chatBlockedReason,
    latestOrderId: orderAccess.latestOrderId,
    latestOrderStatus: orderAccess.latestOrderStatus,
    latestOrderExpiresAt: orderAccess.latestOrderExpiresAt,
    missingTables,
  };
}

export async function getSupportConversationMessages(
  conversationUserId: number,
  supportUsername: string,
  afterId = 0,
  orderId?: number | null
) {
  const params: Array<number> = [conversationUserId];
  const clauses = ['mm.user_id = ?'];

  if (orderId !== undefined) {
    if (orderId && orderId > 0) {
      clauses.push('mm.order_id = ?');
      params.push(orderId);
    } else {
      clauses.push('mm.order_id IS NULL');
    }
  }

  if (afterId > 0) {
    clauses.push('mm.id > ?');
    params.push(afterId);
  }

  const sql = `
    SELECT *
    FROM (
      SELECT
        mm.id,
        mm.user_id,
        mm.order_id,
        mm.support_category,
        mm.sender_type,
        mm.message,
        mm.image_url,
        mm.image_urls,
        DATE_FORMAT(mm.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        o.tiktok_id AS order_tiktok_id,
        o.service_name AS order_service_name,
        o.status AS order_status
      FROM support_tiktok_messages mm
      LEFT JOIN tiktok_support_orders o ON o.id = mm.order_id
      WHERE ${clauses.join('\n        AND ')}
      ORDER BY mm.id DESC
      LIMIT 100
    ) recent_messages
    ORDER BY id ASC
  `;

  const rows = await db.$queryRawUnsafe<SupportMessageRow[]>(sql, ...params);

  return rows.map((row) => mapMessage(row, supportUsername));
}

export async function validateSupportTikTokChatOrder(input: {
  orderId: number;
  conversationUserId: number;
  isSupport: boolean;
}) {
  if (!input.orderId || input.orderId <= 0) {
    return null;
  }

  const rows = await db.$queryRawUnsafe<SupportOrderAccessRow[]>(
    `
      SELECT id, user_id, tiktok_id, service_name, status, ngay_het_han
      FROM tiktok_support_orders
      WHERE id = ?
      LIMIT 1
    `,
    input.orderId
  ).catch(() => []);
  const order = rows[0] || null;

  if (!order) {
    throw new Error('Không tìm thấy đơn TikTok để chat');
  }
  if (Number(order.user_id || 0) !== Number(input.conversationUserId)) {
    throw new Error('Đơn TikTok không thuộc khách đang chọn');
  }

  if (!input.isSupport) {
    const nowText = getVietnamDatabaseDateTime();
    const status = String(order.status || '').trim().toLowerCase();
    const expiresAt = order.ngay_het_han ? serializeDatabaseDateTime(order.ngay_het_han) : '';
    const activeStatus = ['active', 'completed', 'processing', 'success'].includes(status);
    const notExpired = Boolean(expiresAt && expiresAt >= nowText);

    if (!activeStatus || !notExpired) {
      throw new Error('Đơn TikTok này chưa mở hoặc đã hết hạn chat');
    }
  }

  return {
    id: Number(order.id),
    user_id: Number(order.user_id || 0),
    tiktok_id: String(order.tiktok_id || ''),
    service_name: String(order.service_name || ''),
    status: String(order.status || ''),
    ngay_het_han: order.ngay_het_han ? serializeDatabaseDateTime(order.ngay_het_han) : '',
  };
}

export async function createSupportConversationMessage(input: {
  conversationUserId: number;
  orderId?: number | null;
  supportCategory?: string | null;
  message: string;
  senderType: 'user' | 'support';
  supportUsername: string;
  imageUrls?: string[];
}) {
  const imageUrls = input.imageUrls?.filter(Boolean) || [];
  const primaryImage =
    imageUrls.find((image) => image && !/^data:/i.test(image)) ||
    null;

  const created = await db.$transaction(async (tx) => {
    const createdAt = getVietnamDatabaseDateTime();
    await tx.$executeRawUnsafe(
      `
        INSERT INTO support_tiktok_messages (user_id, order_id, support_category, sender_type, message, image_url, image_urls, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      input.conversationUserId,
      input.orderId && input.orderId > 0 ? input.orderId : null,
      input.supportCategory ? input.supportCategory.slice(0, 120) : null,
      input.senderType,
      input.message,
      primaryImage,
      imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      createdAt
    );

    const rows = await tx.$queryRawUnsafe<SupportMessageRow[]>(
      `
        SELECT
          mm.id,
          mm.user_id,
          mm.order_id,
          mm.support_category,
          mm.sender_type,
          mm.message,
          mm.image_url,
          mm.image_urls,
          DATE_FORMAT(mm.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
          o.tiktok_id AS order_tiktok_id,
          o.service_name AS order_service_name,
          o.status AS order_status
        FROM support_tiktok_messages mm
        LEFT JOIN tiktok_support_orders o ON o.id = mm.order_id
        WHERE mm.id = LAST_INSERT_ID()
        LIMIT 1
      `
    );

    return rows[0] || null;
  });

  if (!created) {
    throw new Error('Không thể lưu tin nhắn');
  }

  return mapMessage(created, input.supportUsername);
}

export async function getSupportConversations() {
  const rows = await db.$queryRawUnsafe<ConversationRow[]>(`
    SELECT
      u.id AS user_id,
      u.username,
      u.avatar,
      m_last.order_id,
      o.tiktok_id,
      o.service_name,
      o.status AS order_status,
      m_last.last_message,
      m_last.last_at,
      m_last.last_sender_type
    FROM (
      SELECT
        mm.user_id,
        mm.order_id,
        mm.support_category,
        mm.message AS last_message,
        DATE_FORMAT(mm.created_at, '%Y-%m-%d %H:%i:%s') AS last_at,
        mm.sender_type AS last_sender_type
      FROM support_tiktok_messages mm
      INNER JOIN (
        SELECT user_id, COALESCE(order_id, 0) AS order_key, MAX(id) AS last_id
        FROM support_tiktok_messages
        GROUP BY user_id, COALESCE(order_id, 0)
      ) mx ON mx.user_id = mm.user_id
        AND mx.order_key = COALESCE(mm.order_id, 0)
        AND mx.last_id = mm.id
    ) m_last
    INNER JOIN users u ON u.id = m_last.user_id
    LEFT JOIN tiktok_support_orders o ON o.id = m_last.order_id
    ORDER BY m_last.last_at DESC, m_last.user_id DESC
    LIMIT 200
  `);

  return rows.map((row) => ({
    user_id: Number(row.user_id),
    username: String(row.username || `USER #${row.user_id}`),
    avatar: buildLegacyAssetUrl(row.avatar),
    order_id: row.order_id ? Number(row.order_id) : null,
    tiktok_id: String(row.tiktok_id || ''),
    service_name: String(row.service_name || ''),
    order_status: String(row.order_status || ''),
    last_message: String(row.last_message || ''),
    last_at: serializeDatabaseDateTime(row.last_at) || getVietnamDatabaseDateTime(),
    last_sender_type: String(row.last_sender_type || ''),
  }));
}
