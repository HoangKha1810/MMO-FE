import 'server-only';

import { db } from '@/lib/db';
import { buildLegacyAssetUrl, getLegacySetting } from '@/lib/legacy-settings';
import { getLegacyEnv } from '@/lib/legacy-env';

interface SupportMessageRow {
  id: number;
  user_id: number;
  sender_type: 'user' | 'support';
  message: string | null;
  image_url: string | null;
  image_urls: string | null;
  created_at: Date | string;
}

interface ConversationRow {
  user_id: number;
  username: string | null;
  avatar: string | null;
  last_message: string | null;
  last_at: Date | string | null;
  last_sender_type: 'user' | 'support' | null;
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
    sender_type: row.sender_type,
    sender_name: row.sender_type === 'support' ? supportUsername : '',
    message: String(row.message || ''),
    image_url: row.image_url || '',
    image_urls: parseImageUrls(row.image_urls),
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ''),
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

export async function getSupportTiktokContext(userId: number, clientIp?: string) {
  const [user, settings, hasOrderTable, hasRegionServiceTable, hasMenuTable, hasChatTable] = await Promise.all([
    db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
      },
    }),
    getSettingsMap([
      'support_tiktok_chat_username',
      'service_chat_support_tiktok_status',
      'service_chat_support_tiktok_name',
      'service_chat_support_tiktok_desc',
    ]),
    tableExists('tiktok_support_orders'),
    tableExists('tiktok_region_services'),
    tableExists('tiktok_service_menus'),
    tableExists('support_tiktok_messages'),
  ]);

  if (!user) {
    return null;
  }

  const role = String(user.role || 'member');
  const supportUsername = getLegacyEnv(
    'SUPPORT_TIKTOK_SUPPORT_USERNAME',
    getLegacySetting(settings, 'support_tiktok_chat_username', 'nguyenhatsptik')
  );
  const adminIpAllowed = isIpAllowed(clientIp);
  const supportUsernameAllowed =
    user.username.toLowerCase() === supportUsername.toLowerCase();
  const isSupport =
    role === 'support_tiktok' || role === 'admin' || supportUsernameAllowed;
  const maintenance = getLegacySetting(settings, 'service_chat_support_tiktok_status', 'active') === 'maintenance';
  const missingTables = [
    !hasChatTable ? 'support_tiktok_messages' : '',
    !hasOrderTable ? 'tiktok_support_orders' : '',
    !hasRegionServiceTable ? 'tiktok_region_services' : '',
    !hasMenuTable ? 'tiktok_service_menus' : '',
  ].filter(Boolean);

  return {
    userId: user.id,
    username: user.username,
    role,
    isSupport,
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
    orderModuleAvailable: hasOrderTable && hasRegionServiceTable && hasMenuTable,
    missingTables,
  };
}

export async function getSupportConversationMessages(
  conversationUserId: number,
  supportUsername: string,
  afterId = 0
) {
  const sql = `
    SELECT id, user_id, sender_type, message, image_url, image_urls, created_at
    FROM support_tiktok_messages
    WHERE user_id = ?
      ${afterId > 0 ? 'AND id > ?' : ''}
    ORDER BY id ASC
    LIMIT 100
  `;

  const params = afterId > 0 ? [conversationUserId, afterId] : [conversationUserId];
  const rows = await db.$queryRawUnsafe<SupportMessageRow[]>(sql, ...params);

  return rows.map((row) => mapMessage(row, supportUsername));
}

export async function createSupportConversationMessage(input: {
  conversationUserId: number;
  message: string;
  senderType: 'user' | 'support';
  supportUsername: string;
  imageUrls?: string[];
}) {
  const imageUrls = input.imageUrls?.filter(Boolean) || [];
  const created = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        INSERT INTO support_tiktok_messages (user_id, sender_type, message, image_url, image_urls, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `,
      input.conversationUserId,
      input.senderType,
      input.message,
      imageUrls[0] || '',
      imageUrls.length > 0 ? JSON.stringify(imageUrls) : null
    );

    const rows = await tx.$queryRawUnsafe<SupportMessageRow[]>(
      `
        SELECT id, user_id, sender_type, message, image_url, image_urls, created_at
        FROM support_tiktok_messages
        WHERE id = LAST_INSERT_ID()
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
      m_last.last_message,
      m_last.last_at,
      m_last.last_sender_type
    FROM (
      SELECT mm.user_id, mm.message AS last_message, mm.created_at AS last_at, mm.sender_type AS last_sender_type
      FROM support_tiktok_messages mm
      INNER JOIN (
        SELECT user_id, MAX(id) AS last_id
        FROM support_tiktok_messages
        GROUP BY user_id
      ) mx ON mx.user_id = mm.user_id AND mx.last_id = mm.id
    ) m_last
    INNER JOIN users u ON u.id = m_last.user_id
    ORDER BY m_last.last_at DESC, m_last.user_id DESC
    LIMIT 200
  `);

  return rows.map((row) => ({
    user_id: Number(row.user_id),
    username: String(row.username || `USER #${row.user_id}`),
    avatar: buildLegacyAssetUrl(row.avatar),
    last_message: String(row.last_message || ''),
    last_at:
      row.last_at instanceof Date ? row.last_at.toISOString() : String(row.last_at || ''),
    last_sender_type: String(row.last_sender_type || ''),
  }));
}
