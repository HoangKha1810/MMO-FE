import 'server-only';

import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { buildForumModerationText, cleanForumHtml, containsForumGamblingContent, forumVietnamTimestampSql, isActiveForumStatus } from '@/lib/forum';

interface ForumActionRow {
  [key: string]: unknown;
}

function normalizeRow<T extends ForumActionRow>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, serializeDatabaseDateTime(value)];
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

function normalizeRows<T extends ForumActionRow>(rows: T[]) {
  return rows.map(normalizeRow);
}

async function safeRows<T extends ForumActionRow>(query: string, ...values: unknown[]) {
  try {
    return normalizeRows(await db.$queryRawUnsafe<T[]>(query, ...values));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[forum-actions] query failed', error);
    }
    return [];
  }
}

async function safeOne<T extends ForumActionRow>(query: string, ...values: unknown[]) {
  const rows = await safeRows<T>(query, ...values);
  return rows[0] || null;
}

async function safeCount(query: string, ...values: unknown[]) {
  const rows = await safeRows<{ total: number | bigint } & ForumActionRow>(query, ...values);
  return Number(rows[0]?.total || 0);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function listForumNotifications(userId: number) {
  return safeRows<ForumActionRow>(
    `
      SELECT
        n.id,
        n.user_id,
        n.from_user_id,
        n.type,
        n.message,
        n.link,
        n.is_read,
        n.created_at,
        u.username AS from_username,
        u.avatar AS from_avatar
      FROM notifications n
      LEFT JOIN users u ON u.id = n.from_user_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 100
    `,
    userId
  ).then((rows) => rows.map((row) => ({ ...row, from_avatar: buildLegacyAssetUrl(String(row.from_avatar || '')) || '' })));
}

export async function listForumPrefixes() {
  return safeRows<ForumActionRow>(
    `
      SELECT id, name, color, priority
      FROM forum_prefixes
      ORDER BY priority ASC, id ASC
      LIMIT 100
    `
  );
}

export async function markForumNotificationsRead(userId: number) {
  await db.$executeRawUnsafe(
    `
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND COALESCE(is_read, 0) = 0
    `,
    userId
  ).catch(() => undefined);
}

export async function listUserForumPosts(userId: number) {
  return safeRows<ForumActionRow>(
    `
      SELECT
        p.id,
        p.thread_id,
        p.content,
        p.is_first_post,
        ${forumVietnamTimestampSql('p.created_at')} AS created_at,
        ${forumVietnamTimestampSql('p.updated_at')} AS updated_at,
        p.status,
        t.title,
        t.slug,
        t.forum_id,
        f.name AS forum_name
      FROM forum_posts p
      LEFT JOIN forum_threads t ON t.id = p.thread_id
      LEFT JOIN forums f ON f.id = t.forum_id
      WHERE p.user_id = ?
        AND COALESCE(p.is_deleted, 0) = 0
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 120
    `,
    userId
  ).then((rows) => rows.map((row) => ({
    ...row,
    preview: cleanForumHtml(String(row.content || '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220),
  })));
}

export async function listMyForumAds(userId: number) {
  return safeRows<ForumActionRow>(
    `
      SELECT *
      FROM forum_ads
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 80
    `,
    userId
  ).then((rows) => rows.map((row) => ({ ...row, image_path: buildLegacyAssetUrl(String(row.image_path || '')) || '' })));
}

export async function createForumReply(userId: number, threadId: number, content: string) {
  const thread = await safeOne<ForumActionRow>(
    `
      SELECT id, user_id, title, forum_id, is_locked, status
      FROM forum_threads
      WHERE id = ?
        AND COALESCE(is_deleted, 0) = 0
      LIMIT 1
    `,
    threadId
  );

  if (!thread) {
    throw new Error('Không tìm thấy thread');
  }

  if (!isActiveForumStatus(thread.status)) {
    throw new Error('Thread không còn hoạt động');
  }

  if (Number(thread.is_locked || 0) === 1) {
    throw new Error('Thread đang bị khóa');
  }

  const sanitizedContent = cleanForumHtml(content.trim());
  if (sanitizedContent.replace(/<[^>]+>/g, '').trim().length < 2) {
    throw new Error('Nội dung phản hồi quá ngắn');
  }
  if (containsForumGamblingContent(sanitizedContent)) {
    throw new Error('Nội dung cờ bạc/cá cược không được đăng trong Forum MMO');
  }

  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        INSERT INTO forum_posts (thread_id, user_id, content, is_first_post, status, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, 0, 'pending', NOW(), NOW(), 0)
      `,
      threadId,
      userId,
      sanitizedContent
    );

    const inserted = await tx.$queryRawUnsafe<Array<{ id: number | bigint }>>(
      'SELECT LAST_INSERT_ID() AS id'
    );
    const postId = Number(inserted[0]?.id || 0);

    return { id: postId, thread_id: threadId, status: 'pending' };
  });
}

export async function reactForumPost(userId: number, postId: number, type: string) {
  const normalizedType = type.trim().slice(0, 20) || 'like';
  const existing = await safeOne<ForumActionRow>(
    `
      SELECT id, type
      FROM forum_reactions
      WHERE post_id = ? AND user_id = ?
      LIMIT 1
    `,
    postId,
    userId
  );

  if (existing) {
    if (String(existing.type) === normalizedType) {
      await db.$executeRawUnsafe('DELETE FROM forum_reactions WHERE id = ?', existing.id);
    } else {
      await db.$executeRawUnsafe(
        'UPDATE forum_reactions SET type = ?, created_at = NOW() WHERE id = ?',
        normalizedType,
        existing.id
      );
    }
  } else {
    await db.$executeRawUnsafe(
      `
        INSERT INTO forum_reactions (post_id, user_id, type, created_at)
        VALUES (?, ?, ?, NOW())
      `,
      postId,
      userId,
      normalizedType
    );
  }

  const total = await safeCount('SELECT COUNT(*) AS total FROM forum_reactions WHERE post_id = ?', postId);
  return { total };
}

export async function reportForumPost(userId: number, input: {
  postId: number;
  reason: string;
  details?: string;
}) {
  const post = await safeOne<ForumActionRow>(
    `
      SELECT p.id, p.user_id, p.thread_id
      FROM forum_posts p
      WHERE p.id = ?
        AND COALESCE(p.is_deleted, 0) = 0
      LIMIT 1
    `,
    input.postId
  );

  if (!post) {
    throw new Error('Không tìm thấy bài viết cần report');
  }

  await db.$executeRawUnsafe(
    `
      INSERT INTO forum_reports (post_id, user_id, reported_user_id, reason, details, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NOW())
    `,
    input.postId,
    userId,
    Number(post.user_id || 0) || null,
    input.reason.slice(0, 255),
    String(input.details || '').slice(0, 3000) || null
  );

  return { success: true };
}

export async function createForumAd(userId: number, input: {
  durationDays: number;
  linkUrl: string;
  imagePath?: string;
}) {
  const durationDays = Math.max(1, Math.min(365, Math.trunc(Number(input.durationDays || 30))));
  const priceVnd = durationDays * 130000;

  await db.$executeRawUnsafe(
    `
      INSERT INTO forum_ads (user_id, status, price_vnd, duration_days, image_path, link_url, created_at, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    `,
    userId,
    input.imagePath ? 'pending' : 'awaiting_upload',
    priceVnd,
    durationDays,
    input.imagePath || null,
    input.linkUrl || null,
    input.imagePath ? new Date() : null
  );

  return safeOne<ForumActionRow>(
    'SELECT * FROM forum_ads WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    userId
  );
}

export async function updateForumAd(userId: number, adId: number, input: {
  durationDays?: number;
  linkUrl?: string;
  imagePath?: string;
}) {
  const ad = await safeOne<ForumActionRow>(
    'SELECT * FROM forum_ads WHERE id = ? AND user_id = ? LIMIT 1',
    adId,
    userId
  );

  if (!ad) {
    throw new Error('Không tìm thấy quảng cáo');
  }

  const durationDays = input.durationDays
    ? Math.max(1, Math.min(365, Math.trunc(Number(input.durationDays))))
    : Number(ad.duration_days || 30);
  const nextImagePath = input.imagePath || String(ad.image_path || '');
  const nextLinkUrl = typeof input.linkUrl === 'string' ? input.linkUrl : String(ad.link_url || '');

  await db.$executeRawUnsafe(
    `
      UPDATE forum_ads
      SET duration_days = ?,
          price_vnd = ?,
          image_path = ?,
          link_url = ?,
          status = ?,
          uploaded_at = CASE WHEN ? IS NOT NULL THEN NOW() ELSE uploaded_at END
      WHERE id = ? AND user_id = ?
    `,
    durationDays,
    durationDays * 130000,
    nextImagePath || null,
    nextLinkUrl || null,
    nextImagePath ? 'pending' : 'awaiting_upload',
    nextImagePath || null,
    adId,
    userId
  );

  return safeOne<ForumActionRow>('SELECT * FROM forum_ads WHERE id = ? LIMIT 1', adId);
}

export async function listForumAdsFeed(userId?: number) {
  const rows = await safeRows<ForumActionRow>(
    `
      SELECT
        a.*,
        u.username,
        u.avatar
      FROM forum_ads a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.status IN ('approved', 'pending', 'awaiting_upload')
      ${userId ? 'OR a.user_id = ?' : ''}
      ORDER BY FIELD(a.status, 'approved', 'pending', 'awaiting_upload', 'rejected', 'expired'), a.created_at DESC
      LIMIT 120
    `,
    ...(userId ? [userId] : [])
  );

  return rows.map((row) => ({
    ...row,
    avatar: buildLegacyAssetUrl(String(row.avatar || '')) || '',
    image_path: buildLegacyAssetUrl(String(row.image_path || '')) || '',
  }));
}

export async function getForumAdDetail(userId: number, adId: number) {
  const ad = await safeOne<ForumActionRow>(
    `
      SELECT *
      FROM forum_ads
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    adId,
    userId
  );

  return ad ? { ...ad, image_path: buildLegacyAssetUrl(String(ad.image_path || '')) || '' } : null;
}

export async function getForumAdStats(userId: number) {
  const [myAds, approvedAds, pendingAds] = await Promise.all([
    safeCount('SELECT COUNT(*) AS total FROM forum_ads WHERE user_id = ?', userId),
    safeCount('SELECT COUNT(*) AS total FROM forum_ads WHERE user_id = ? AND status = \'approved\'', userId),
    safeCount('SELECT COUNT(*) AS total FROM forum_ads WHERE user_id = ? AND status IN (\'pending\', \'awaiting_upload\')', userId),
  ]);

  return { myAds, approvedAds, pendingAds };
}

export async function createForumThreadWithPrefix(userId: number, input: {
  forumId: number;
  title: string;
  content: string;
  prefixId?: number;
}) {
  const forum = await safeOne<ForumActionRow>(
    'SELECT id, name FROM forums WHERE id = ? LIMIT 1',
    input.forumId
  );

  if (!forum) {
    throw new Error('Không tìm thấy box đăng bài');
  }

  const title = input.title.trim();
  const content = cleanForumHtml(input.content.trim());
  if (title.length < 6 || content.replace(/<[^>]+>/g, '').trim().length < 10) {
    throw new Error('Tiêu đề hoặc nội dung quá ngắn');
  }
  if (containsForumGamblingContent(buildForumModerationText({ title, content }))) {
    throw new Error('Nội dung cờ bạc/cá cược không được đăng trong Forum MMO');
  }

  const slug = `${slugify(title)}-${Date.now()}`;

  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        INSERT INTO forum_threads (forum_id, user_id, title, slug, status, created_at, updated_at, prefix_id, is_pinned, is_locked, is_deleted)
        VALUES (?, ?, ?, ?, 'pending', NOW(), NOW(), ?, 0, 0, 0)
      `,
      input.forumId,
      userId,
      title,
      slug,
      input.prefixId || null
    );
    const inserted = await tx.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
    const threadId = Number(inserted[0]?.id || 0);
    if (!threadId) {
      throw new Error('Không tạo được thread');
    }

    await tx.$executeRawUnsafe(
      `
        INSERT INTO forum_posts (thread_id, user_id, content, is_first_post, status, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, 1, 'pending', NOW(), NOW(), 0)
      `,
      threadId,
      userId,
      content
    );

    const firstPost = await tx.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
    const postId = Number(firstPost[0]?.id || 0);
    await tx.$executeRawUnsafe(
      'UPDATE forum_threads SET last_post_id = ? WHERE id = ?',
      postId,
      threadId
    ).catch(() => undefined);
    return { id: threadId };
  });
}
