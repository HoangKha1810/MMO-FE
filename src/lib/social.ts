import 'server-only';

import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';

interface SocialRow {
  [key: string]: unknown;
}

function normalizeRow<T extends SocialRow>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }

      if (typeof value === 'bigint') {
        return [key, Number(value)];
      }

      if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
        return [key, value.toNumber()];
      }

      return [key, value];
    })
  ) as T;
}

function normalizeRows<T extends SocialRow>(rows: T[]) {
  return rows.map(normalizeRow);
}

async function safeRows<T extends SocialRow>(query: string, ...values: unknown[]) {
  try {
    return normalizeRows(await db.$queryRawUnsafe<T[]>(query, ...values));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[social] query failed', error);
    }

    return [];
  }
}

async function safeOne<T extends SocialRow>(query: string, ...values: unknown[]) {
  const rows = await safeRows<T>(query, ...values);
  return rows[0] || null;
}

async function safeCount(query: string, ...values: unknown[]) {
  const rows = await safeRows<Array<{ total: number | bigint }>[number] & SocialRow>(query, ...values);
  return Number(rows[0]?.total || 0);
}

function mapAvatar<T extends SocialRow>(row: T, key = 'avatar') {
  return {
    ...row,
    [key]: buildLegacyAssetUrl(String(row[key] || '')) || '',
  } as T;
}

export async function getSocialCounters(userId: number) {
  const [pendingRequests, unreadMessages, unreadNotifications, blockedCount] = await Promise.all([
    safeCount(
      `
        SELECT COUNT(*) AS total
        FROM friendships
        WHERE addressee = ? AND status = 'pending'
      `,
      userId
    ),
    safeCount(
      `
        SELECT COUNT(*) AS total
        FROM private_messages
        WHERE receiver_id = ?
          AND is_read = 0
          AND COALESCE(is_deleted, 0) = 0
      `,
      userId
    ),
    safeCount(
      `
        SELECT COUNT(*) AS total
        FROM notifications
        WHERE user_id = ? AND COALESCE(is_read, 0) = 0
      `,
      userId
    ),
    safeCount(
      `
        SELECT COUNT(*) AS total
        FROM msg_blocks
        WHERE blocker_id = ?
      `,
      userId
    ),
  ]);

  return { pendingRequests, unreadMessages, unreadNotifications, blockedCount };
}

export async function listSocialFriendsAdvanced(userId: number) {
  const rows = await safeRows<SocialRow>(
    `
      SELECT
        f.id,
        f.requester,
        f.addressee,
        f.status,
        f.created_at,
        f.updated_at,
        CASE WHEN f.requester = ? THEN f.addressee ELSE f.requester END AS friend_id,
        u.username,
        u.fullname,
        u.avatar,
        u.rank,
        u.role,
        u.last_activity,
        (
          SELECT COUNT(*)
          FROM private_messages pm
          WHERE pm.sender_id = u.id
            AND pm.receiver_id = ?
            AND pm.is_read = 0
            AND COALESCE(pm.is_deleted, 0) = 0
        ) AS unread_count
      FROM friendships f
      LEFT JOIN users u ON u.id = CASE WHEN f.requester = ? THEN f.addressee ELSE f.requester END
      WHERE (f.requester = ? OR f.addressee = ?)
      ORDER BY FIELD(f.status, 'pending', 'accepted', 'blocked'), f.updated_at DESC, f.id DESC
      LIMIT 200
    `,
    userId,
    userId,
    userId,
    userId,
    userId
  );

  return rows.map((row) => mapAvatar(row));
}

export async function listPendingFriendRequests(userId: number) {
  const rows = await safeRows<SocialRow>(
    `
      SELECT
        f.id,
        f.requester,
        f.addressee,
        f.status,
        f.created_at,
        f.updated_at,
        u.username,
        u.fullname,
        u.avatar,
        u.rank,
        u.role
      FROM friendships f
      LEFT JOIN users u ON u.id = f.requester
      WHERE f.addressee = ? AND f.status = 'pending'
      ORDER BY f.updated_at DESC, f.id DESC
      LIMIT 100
    `,
    userId
  );

  return rows.map((row) => mapAvatar(row));
}

export async function listBlockedUsers(userId: number) {
  const rows = await safeRows<SocialRow>(
    `
      SELECT
        b.id,
        b.blocker_id,
        b.blocked_id,
        b.created_at,
        u.username,
        u.fullname,
        u.avatar,
        u.rank,
        u.role
      FROM msg_blocks b
      LEFT JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = ?
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT 120
    `,
    userId
  );

  return rows.map((row) => mapAvatar(row));
}

export async function getMiniInbox(userId: number) {
  const rows = await safeRows<SocialRow>(
    `
      SELECT
        pm.id,
        pm.sender_id,
        pm.receiver_id,
        pm.content,
        pm.created_at,
        pm.attachment,
        pm.file_type,
        CASE WHEN pm.sender_id = ? THEN pm.receiver_id ELSE pm.sender_id END AS other_id,
        u.username,
        u.fullname,
        u.avatar,
        (
          SELECT COUNT(*)
          FROM private_messages unread
          WHERE unread.sender_id = CASE WHEN pm.sender_id = ? THEN pm.receiver_id ELSE pm.sender_id END
            AND unread.receiver_id = ?
            AND unread.is_read = 0
            AND COALESCE(unread.is_deleted, 0) = 0
        ) AS unread_count
      FROM private_messages pm
      INNER JOIN (
        SELECT MAX(id) AS last_id
        FROM private_messages
        WHERE (sender_id = ? OR receiver_id = ?)
          AND COALESCE(is_deleted, 0) = 0
        GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
      ) latest ON latest.last_id = pm.id
      LEFT JOIN users u ON u.id = CASE WHEN pm.sender_id = ? THEN pm.receiver_id ELSE pm.sender_id END
      ORDER BY pm.created_at DESC, pm.id DESC
      LIMIT 40
    `,
    userId,
    userId,
    userId,
    userId,
    userId,
    userId
  );

  return rows.map((row) => ({
    ...mapAvatar(row),
    attachment: buildLegacyAssetUrl(String(row.attachment || '')) || '',
  }));
}

export async function getAdminMessages(userId: number) {
  const rows = await safeRows<SocialRow>(
    `
      SELECT id, admin_id, user_id, message, show_limit, shown_count, status, created_at
      FROM admin_private_messages
      WHERE user_id = ?
        AND status = 'active'
        AND (show_limit IS NULL OR shown_count < show_limit)
      ORDER BY created_at DESC, id DESC
      LIMIT 20
    `,
    userId
  );

  return rows;
}

export async function markAdminMessagesShown(userId: number) {
  await db.$executeRawUnsafe(
    `
      UPDATE admin_private_messages
      SET shown_count = shown_count + 1
      WHERE user_id = ?
        AND status = 'active'
        AND (show_limit IS NULL OR shown_count < show_limit)
    `,
    userId
  ).catch(() => undefined);
}

export async function searchSocialDirectory(userId: number, keyword: string) {
  const normalized = keyword.trim();
  if (!normalized) {
    return { users: [], conversations: [] };
  }

  const like = `%${normalized}%`;
  const [users, conversations] = await Promise.all([
    safeRows<SocialRow>(
      `
        SELECT id, username, fullname, avatar, rank, role, last_activity
        FROM users
        WHERE id <> ?
          AND status = 'active'
          AND (
            username LIKE ?
            OR fullname LIKE ?
            OR email LIKE ?
            OR contact LIKE ?
          )
        ORDER BY last_activity DESC, id DESC
        LIMIT 60
      `,
      userId,
      like,
      like,
      like,
      like
    ),
    safeRows<SocialRow>(
      `
        SELECT
          pm.id,
          pm.content,
          pm.created_at,
          CASE WHEN pm.sender_id = ? THEN pm.receiver_id ELSE pm.sender_id END AS other_id,
          u.username,
          u.fullname,
          u.avatar
        FROM private_messages pm
        LEFT JOIN users u ON u.id = CASE WHEN pm.sender_id = ? THEN pm.receiver_id ELSE pm.sender_id END
        WHERE (pm.sender_id = ? OR pm.receiver_id = ?)
          AND COALESCE(pm.is_deleted, 0) = 0
          AND (
            pm.content LIKE ?
            OR u.username LIKE ?
            OR u.fullname LIKE ?
          )
        ORDER BY pm.created_at DESC, pm.id DESC
        LIMIT 60
      `,
      userId,
      userId,
      userId,
      userId,
      like,
      like,
      like
    ),
  ]);

  return {
    users: users.map((row) => mapAvatar(row)),
    conversations: conversations.map((row) => mapAvatar(row)),
  };
}

export async function getFriendStatus(userId: number, targetUserId: number) {
  if (!targetUserId || targetUserId === userId) {
    return { friendship: null, blockedByMe: false, blockedMe: false };
  }

  const [friendship, blockedByMe, blockedMe] = await Promise.all([
    safeOne<SocialRow>(
      `
        SELECT *
        FROM friendships
        WHERE (requester = ? AND addressee = ?)
           OR (requester = ? AND addressee = ?)
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      userId,
      targetUserId,
      targetUserId,
      userId
    ),
    safeOne<SocialRow>('SELECT id FROM msg_blocks WHERE blocker_id = ? AND blocked_id = ? LIMIT 1', userId, targetUserId),
    safeOne<SocialRow>('SELECT id FROM msg_blocks WHERE blocker_id = ? AND blocked_id = ? LIMIT 1', targetUserId, userId),
  ]);

  return {
    friendship,
    blockedByMe: Boolean(blockedByMe),
    blockedMe: Boolean(blockedMe),
  };
}

export async function runFriendAction(userId: number, targetUserId: number, action: string) {
  if (!targetUserId || targetUserId === userId) {
    throw new Error('Người dùng mục tiêu không hợp lệ');
  }

  const target = await safeOne<SocialRow>(
    'SELECT id, username, status FROM users WHERE id = ? LIMIT 1',
    targetUserId
  );
  if (!target || String(target.status || 'active') !== 'active') {
    throw new Error('Không tìm thấy người dùng đang hoạt động');
  }

  if (action === 'status') {
    return getFriendStatus(userId, targetUserId);
  }

  if (action === 'block') {
    await db.$executeRawUnsafe(
      `
        INSERT INTO msg_blocks (blocker_id, blocked_id, created_at)
        SELECT ?, ?, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM msg_blocks WHERE blocker_id = ? AND blocked_id = ?
        )
      `,
      userId,
      targetUserId,
      userId,
      targetUserId
    );
    await db.$executeRawUnsafe(
      `
        UPDATE friendships
        SET status = 'blocked', updated_at = NOW()
        WHERE (requester = ? AND addressee = ?) OR (requester = ? AND addressee = ?)
      `,
      userId,
      targetUserId,
      targetUserId,
      userId
    ).catch(() => undefined);
    return { success: true, message: 'Đã chặn người dùng' };
  }

  if (action === 'unblock') {
    await db.$executeRawUnsafe(
      'DELETE FROM msg_blocks WHERE blocker_id = ? AND blocked_id = ?',
      userId,
      targetUserId
    );
    await db.$executeRawUnsafe(
      `
        UPDATE friendships
        SET status = 'accepted', updated_at = NOW()
        WHERE ((requester = ? AND addressee = ?) OR (requester = ? AND addressee = ?))
          AND status = 'blocked'
      `,
      userId,
      targetUserId,
      targetUserId,
      userId
    ).catch(() => undefined);
    return { success: true, message: 'Đã mở chặn' };
  }

  const blockState = await getFriendStatus(userId, targetUserId);
  if (blockState.blockedByMe || blockState.blockedMe) {
    throw new Error('Không thể thao tác khi một trong hai bên đang chặn');
  }

  if (action === 'request') {
    await db.$executeRawUnsafe(
      `
        INSERT INTO friendships (requester, addressee, status, created_at, updated_at)
        SELECT ?, ?, 'pending', NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1
          FROM friendships
          WHERE (requester = ? AND addressee = ?)
             OR (requester = ? AND addressee = ?)
        )
      `,
      userId,
      targetUserId,
      userId,
      targetUserId,
      targetUserId,
      userId
    );

    const existing = await safeOne<SocialRow>(
      `
        SELECT *
        FROM friendships
        WHERE (requester = ? AND addressee = ?)
           OR (requester = ? AND addressee = ?)
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      userId,
      targetUserId,
      targetUserId,
      userId
    );

    if (existing && String(existing.status) === 'pending' && Number(existing.requester) === targetUserId) {
      await db.$executeRawUnsafe(
        'UPDATE friendships SET status = \'accepted\', updated_at = NOW() WHERE id = ?',
        existing.id
      );
      return { success: true, message: 'Đã chấp nhận lời mời kết bạn' };
    }

    return { success: true, message: 'Đã gửi lời mời kết bạn' };
  }

  if (action === 'accept') {
    await db.$executeRawUnsafe(
      `
        UPDATE friendships
        SET status = 'accepted', updated_at = NOW()
        WHERE requester = ? AND addressee = ? AND status = 'pending'
      `,
      targetUserId,
      userId
    );
    return { success: true, message: 'Đã chấp nhận lời mời' };
  }

  if (action === 'decline') {
    await db.$executeRawUnsafe(
      `
        DELETE FROM friendships
        WHERE requester = ? AND addressee = ? AND status = 'pending'
      `,
      targetUserId,
      userId
    );
    return { success: true, message: 'Đã từ chối lời mời' };
  }

  if (action === 'remove') {
    await db.$executeRawUnsafe(
      `
        DELETE FROM friendships
        WHERE (requester = ? AND addressee = ?)
           OR (requester = ? AND addressee = ?)
      `,
      userId,
      targetUserId,
      targetUserId,
      userId
    );
    return { success: true, message: 'Đã xóa kết bạn' };
  }

  throw new Error('Action không hợp lệ');
}

export async function markConversationRead(userId: number, otherUserId: number) {
  await db.$executeRawUnsafe(
    `
      UPDATE private_messages
      SET is_read = 1
      WHERE sender_id = ?
        AND receiver_id = ?
        AND is_read = 0
    `,
    otherUserId,
    userId
  ).catch(() => undefined);
}

export async function getConversationAdvanced(userId: number, otherUserId: number) {
  const [other, state, messages] = await Promise.all([
    safeOne<SocialRow>(
      `
        SELECT id, username, fullname, avatar, rank, role, status, last_activity
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      otherUserId
    ),
    getFriendStatus(userId, otherUserId),
    safeRows<SocialRow>(
      `
        SELECT
          pm.*,
          su.username AS sender_username,
          ru.username AS receiver_username
        FROM private_messages pm
        LEFT JOIN users su ON su.id = pm.sender_id
        LEFT JOIN users ru ON ru.id = pm.receiver_id
        WHERE ((pm.sender_id = ? AND pm.receiver_id = ?) OR (pm.sender_id = ? AND pm.receiver_id = ?))
          AND COALESCE(pm.is_deleted, 0) = 0
        ORDER BY pm.id ASC
        LIMIT 300
      `,
      userId,
      otherUserId,
      otherUserId,
      userId
    ),
  ]);

  if (!other) {
    return null;
  }

  await markConversationRead(userId, otherUserId);

  const typing = await safeOne<SocialRow>(
    `
      SELECT user_id, typing_to, updated_at
      FROM msg_typing
      WHERE user_id = ?
        AND typing_to = ?
        AND updated_at >= DATE_SUB(NOW(), INTERVAL 12 SECOND)
      LIMIT 1
    `,
    otherUserId,
    userId
  );

  return {
    other: mapAvatar(other),
    friendship: state.friendship,
    blockedByMe: state.blockedByMe,
    blockedMe: state.blockedMe,
    typing: Boolean(typing),
    messages: messages.map((message) => ({
      ...message,
      attachment: buildLegacyAssetUrl(String(message.attachment || '')) || '',
    })),
  };
}

export async function sendSocialMessage(input: {
  senderId: number;
  receiverId: number;
  content: string;
  attachment?: string;
  fileType?: string;
}) {
  const { senderId, receiverId, content, attachment = '', fileType = '' } = input;
  if (!receiverId || receiverId === senderId) {
    throw new Error('Người nhận không hợp lệ');
  }

  const state = await getFriendStatus(senderId, receiverId);
  if (state.blockedByMe || state.blockedMe) {
    throw new Error('Không thể gửi tin nhắn khi một trong hai bên đang chặn');
  }

  await db.$executeRawUnsafe(
    `
      INSERT INTO private_messages (sender_id, receiver_id, content, is_read, created_at, attachment, file_type, is_deleted, is_suspicious)
      VALUES (?, ?, ?, 0, NOW(), ?, ?, 0, 0)
    `,
    senderId,
    receiverId,
    content,
    attachment,
    fileType
  );

  await db.$executeRawUnsafe(
    `
      INSERT INTO notifications (user_id, from_user_id, type, message, link, is_read, created_at)
      VALUES (?, ?, 'private_message', ?, ?, 0, NOW())
    `,
    receiverId,
    senderId,
    'Bạn có tin nhắn mới trong Social Messenger',
    `/user/social/conversation/${senderId}`
  ).catch(() => undefined);

  return safeOne<SocialRow>(
    `
      SELECT *
      FROM private_messages
      WHERE sender_id = ? AND receiver_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    senderId,
    receiverId
  );
}

export async function deleteSocialMessage(userId: number, messageId: number) {
  const message = await safeOne<SocialRow>(
    `
      SELECT id, sender_id, receiver_id
      FROM private_messages
      WHERE id = ?
      LIMIT 1
    `,
    messageId
  );

  if (!message) {
    throw new Error('Không tìm thấy tin nhắn');
  }

  if (Number(message.sender_id) !== userId && Number(message.receiver_id) !== userId) {
    throw new Error('Bạn không có quyền xóa tin nhắn này');
  }

  await db.$executeRawUnsafe(
    'UPDATE private_messages SET is_deleted = 1 WHERE id = ?',
    messageId
  );

  return { success: true, message: 'Đã xóa tin nhắn' };
}

export async function clearSocialConversation(userId: number, otherUserId: number) {
  await db.$executeRawUnsafe(
    `
      UPDATE private_messages
      SET is_deleted = 1
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
    `,
    userId,
    otherUserId,
    otherUserId,
    userId
  );

  return { success: true, message: 'Đã xóa toàn bộ đoạn chat' };
}

export async function setSocialTyping(userId: number, otherUserId: number) {
  await db.$executeRawUnsafe(
    `
      INSERT INTO msg_typing (user_id, typing_to, updated_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE updated_at = NOW()
    `,
    userId,
    otherUserId
  ).catch(async () => {
    await db.$executeRawUnsafe(
      `
        DELETE FROM msg_typing
        WHERE user_id = ? AND typing_to = ?
      `,
      userId,
      otherUserId
    ).catch(() => undefined);
    await db.$executeRawUnsafe(
      `
        INSERT INTO msg_typing (user_id, typing_to, updated_at)
        VALUES (?, ?, NOW())
      `,
      userId,
      otherUserId
    ).catch(() => undefined);
  });

  return { success: true };
}

export async function getConversationPoll(userId: number, otherUserId: number, afterId = 0) {
  await markConversationRead(userId, otherUserId);

  const [messages, typing, unreadCount] = await Promise.all([
    safeRows<SocialRow>(
      `
        SELECT *
        FROM private_messages
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
          AND COALESCE(is_deleted, 0) = 0
          ${afterId > 0 ? 'AND id > ?' : ''}
        ORDER BY id ASC
        LIMIT 120
      `,
      ...(afterId > 0
        ? [userId, otherUserId, otherUserId, userId, afterId]
        : [userId, otherUserId, otherUserId, userId])
    ),
    safeOne<SocialRow>(
      `
        SELECT user_id, typing_to, updated_at
        FROM msg_typing
        WHERE user_id = ?
          AND typing_to = ?
          AND updated_at >= DATE_SUB(NOW(), INTERVAL 12 SECOND)
        LIMIT 1
      `,
      otherUserId,
      userId
    ),
    safeCount(
      `
        SELECT COUNT(*) AS total
        FROM private_messages
        WHERE receiver_id = ?
          AND is_read = 0
          AND COALESCE(is_deleted, 0) = 0
      `,
      userId
    ),
  ]);

  return {
    messages: messages.map((message) => ({
      ...message,
      attachment: buildLegacyAssetUrl(String(message.attachment || '')) || '',
    })),
    typing: Boolean(typing),
    unreadCount,
  };
}
