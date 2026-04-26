import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { processBankDepositByCode, processSePayDepositByCode } from '@/lib/deposit-processing';
import { cleanForumHtml } from '@/lib/forum';
import { toNumber } from '@/lib/utils';

export type LegacyRow = Record<string, unknown>;

interface CountRow {
  total: number | bigint;
}

const tableCache = new Map<string, boolean>();

export function normalizeLegacyRow<T extends LegacyRow>(row: T): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value instanceof Date) return [key, serializeDatabaseDateTime(value)];
    if (typeof value === 'bigint') return [key, Number(value)];
    if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
      return [key, value.toNumber()];
    }
    return [key, value];
  })) as T;
}

export function normalizeLegacyRows<T extends LegacyRow>(rows: T[]): T[] {
  return rows.map(normalizeLegacyRow);
}

export async function tableExists(table: string) {
  if (tableCache.has(table)) return tableCache.get(table)!;
  try {
    const rows = await db.$queryRawUnsafe<Array<{ table_name: string }>>(
      `
        SELECT TABLE_NAME AS table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?
        LIMIT 1
      `,
      table
    );
    const exists = rows.length > 0;
    if (exists) {
      tableCache.set(table, true);
    }
    return exists;
  } catch {
    return false;
  }
}

export async function safeRows<T extends LegacyRow>(query: string, ...values: unknown[]): Promise<T[]> {
  try {
    return normalizeLegacyRows(await db.$queryRawUnsafe<T[]>(query, ...values));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[legacy-modules] query failed', error);
    }
    return [];
  }
}

export async function safeOne<T extends LegacyRow>(query: string, ...values: unknown[]): Promise<T | null> {
  const rows = await safeRows<T>(query, ...values);
  return rows[0] || null;
}

export async function safeCount(query: string, ...values: unknown[]) {
  const rows = await safeRows<CountRow & LegacyRow>(query, ...values);
  return Number(rows[0]?.total || 0);
}

export async function listResourceCategories() {
  if (!(await tableExists('resource_categories'))) return [];
  return safeRows<LegacyRow>(`
    SELECT id, parent_id, name, slug, icon, image, description, display_order, status
    FROM resource_categories
    WHERE COALESCE(is_deleted, 0) = 0
    ORDER BY display_order ASC, name ASC
  `);
}

export async function listResources(input: { search?: string; category?: string; limit?: number } = {}) {
  const values: unknown[] = [];
  const where = ["r.status = 'active'", 'COALESCE(r.is_deleted, 0) = 0'];

  if (input.search) {
    where.push('(r.title LIKE ? OR r.description LIKE ? OR r.category LIKE ? OR r.tags LIKE ?)');
    values.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`, `%${input.search}%`);
  }

  if (input.category) {
    where.push('(r.category = ? OR rc.slug = ? OR CAST(r.category_id AS CHAR) = ?)');
    values.push(input.category, input.category, input.category);
  }

  values.push(Math.min(120, Math.max(1, input.limit || 80)));

  return safeRows<LegacyRow>(`
    SELECT
      r.id,
      r.product_code,
      r.title,
      r.description,
      r.category,
      r.category_id,
      r.price,
      r.original_price,
      r.thumbnail,
      r.resource_type,
      r.stock,
      r.sold_count,
      r.tags,
      r.featured,
      r.is_pinned,
      r.custom_badge,
      r.created_at,
      rc.name AS category_name,
      rc.slug AS category_slug,
      rc.image AS category_image
    FROM mmo_resources r
    LEFT JOIN resource_categories rc ON rc.id = r.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY r.is_pinned DESC, r.featured DESC, r.display_order ASC, r.created_at DESC
    LIMIT ?
  `, ...values);
}

export async function getResourceDetail(id: number, userId?: number) {
  const resource = await safeOne<LegacyRow>(`
    SELECT r.*, rc.name AS category_name, rc.slug AS category_slug
    FROM mmo_resources r
    LEFT JOIN resource_categories rc ON rc.id = r.category_id
    WHERE r.id = ?
      AND COALESCE(r.is_deleted, 0) = 0
    LIMIT 1
  `, id);

  if (!resource) return null;

  const [related, orders] = await Promise.all([
    listResources({ category: String(resource.category_slug || resource.category || ''), limit: 6 }),
    userId ? safeRows<LegacyRow>(`
      SELECT id, quantity, total_price, status, download_count, max_downloads, created_at, expires_at
      FROM resource_orders
      WHERE user_id = ? AND resource_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, userId, id) : Promise.resolve([]),
  ]);

  return { resource: normalizeLegacyRow(resource), related: related.filter((item) => Number(item.id) !== id), orders };
}

export async function listResourceHistory(userId: number) {
  return safeRows<LegacyRow>(`
    SELECT
      o.id,
      o.resource_id,
      o.quantity,
      o.total_price,
      o.status,
      o.download_count,
      o.max_downloads,
      o.expires_at,
      o.created_at,
      r.title,
      r.thumbnail,
      r.product_code
    FROM resource_orders o
    LEFT JOIN mmo_resources r ON r.id = o.resource_id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
    LIMIT 80
  `, userId);
}

function canViewModeratedJob(job: LegacyRow, viewerId?: number, viewerRole?: string | null) {
  const status = String(job.status || '').toLowerCase();
  if (['open', 'active', 'approved'].includes(status)) {
    return true;
  }

  const ownerId = Number(job.user_id || job.posted_by || 0);
  return Boolean(viewerId && ownerId === viewerId) || String(viewerRole || '').toLowerCase() === 'admin';
}

export async function getFindJobDetail(id: number, viewerId?: number, viewerRole?: string | null) {
  const table = await tableExists('find_job_jobs') ? 'find_job_jobs' : 'find_jobs';

  if (table === 'find_job_jobs') {
    const job = await safeOne<LegacyRow>(`
      SELECT j.*, j.posted_by AS user_id, u.username, u.avatar, u.rank
      FROM find_job_jobs j
      LEFT JOIN users u ON u.id = j.posted_by
      WHERE j.id = ?
      LIMIT 1
    `, id);
    if (!job) return null;
    if (!canViewModeratedJob(job, viewerId, viewerRole)) return null;
    const applications = await safeRows<LegacyRow>(`
      SELECT a.*, u.username, u.avatar
      FROM find_job_applications a
      LEFT JOIN users u ON u.id = a.applicant_id
      WHERE a.job_id = ?
      ORDER BY a.applied_at DESC
      LIMIT 50
    `, id);
    return { table, job, applications };
  }

  const job = await safeOne<LegacyRow>(`
    SELECT j.*, j.user_id, u.username, u.avatar, u.rank
    FROM find_jobs j
    LEFT JOIN users u ON u.id = j.user_id
    WHERE j.id = ?
    LIMIT 1
  `, id);
  if (!job || !canViewModeratedJob(job, viewerId, viewerRole)) return null;
  return { table, job, applications: [] };
}

export async function createFindJob(userId: number, input: { title: string; description: string; category: string; price_min?: number; price_max?: number; deadline_days?: number }) {
  const table = await tableExists('find_job_jobs') ? 'find_job_jobs' : 'find_jobs';
  const now = new Date();

  if (table === 'find_job_jobs') {
    const slug = `${input.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
    await db.$executeRawUnsafe(`
      INSERT INTO find_job_jobs (title, slug, description, category, budget_type, price_min, price_max, deadline_days, posted_by, posted_at, status, approval_status, updated_at)
      VALUES (?, ?, ?, ?, 'fixed', ?, ?, ?, ?, ?, 'pending', 'pending', ?)
    `, input.title, slug, input.description, input.category, input.price_min || null, input.price_max || null, input.deadline_days || null, userId, now, now);
    return safeOne<LegacyRow>('SELECT * FROM find_job_jobs WHERE posted_by = ? ORDER BY id DESC LIMIT 1', userId);
  }

  await db.$executeRawUnsafe(`
    INSERT INTO find_jobs (user_id, title, description, budget_min, budget_max, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `, userId, input.title, input.description, input.price_min || null, input.price_max || null, now, now);
  return safeOne<LegacyRow>('SELECT * FROM find_jobs WHERE user_id = ? ORDER BY id DESC LIMIT 1', userId);
}

export async function listForumMembers(limit = 80) {
  return safeRows<LegacyRow>(`
    SELECT id, username, fullname, avatar, role, rank, post_count, is_blue_tick, created_at, last_activity
    FROM users
    WHERE status = 'active'
    ORDER BY post_count DESC, id DESC
    LIMIT ?
  `, limit);
}

export async function searchForum(keyword: string) {
  if (!keyword.trim()) return { threads: [], posts: [] };
  const like = `%${keyword.trim()}%`;
  const [threads, posts] = await Promise.all([
    safeRows<LegacyRow>(`
      SELECT t.id, t.title, t.views, t.is_pinned, t.created_at, f.name AS forum_name, u.username
      FROM forum_threads t
      LEFT JOIN forums f ON f.id = t.forum_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.status = 'active'
        AND COALESCE(t.is_deleted, 0) = 0
        AND t.title LIKE ?
      ORDER BY t.is_pinned DESC, t.updated_at DESC
      LIMIT 40
    `, like),
    safeRows<LegacyRow>(`
      SELECT p.id, p.thread_id, p.content, p.created_at, t.title, u.username
      FROM forum_posts p
      LEFT JOIN forum_threads t ON t.id = p.thread_id
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.status = 'active'
        AND COALESCE(p.is_deleted, 0) = 0
        AND p.content LIKE ?
      ORDER BY p.created_at DESC
      LIMIT 40
    `, like),
  ]);

  return {
    threads,
    posts: posts.map((post) => ({ ...post, content: cleanForumHtml(String(post.content || '')).replace(/<[^>]+>/g, ' ').slice(0, 260) })),
  };
}

export async function listForumActivity(limit = 80) {
  const [threads, posts, ads] = await Promise.all([
    safeRows<LegacyRow>(`
      SELECT 'thread' AS type, t.id, t.title AS title, t.created_at, u.username
      FROM forum_threads t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.status = 'active' AND COALESCE(t.is_deleted, 0) = 0
      ORDER BY t.created_at DESC
      LIMIT ?
    `, limit),
    safeRows<LegacyRow>(`
      SELECT 'post' AS type, p.id, p.thread_id, t.title, p.created_at, u.username
      FROM forum_posts p
      LEFT JOIN forum_threads t ON t.id = p.thread_id
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.status = 'active' AND COALESCE(p.is_deleted, 0) = 0
      ORDER BY p.created_at DESC
      LIMIT ?
    `, limit),
    safeRows<LegacyRow>(`
      SELECT 'ad' AS type, id, link_url AS title, created_at, status
      FROM forum_ads
      ORDER BY created_at DESC
      LIMIT 20
    `),
  ]);

  return [...threads, ...posts, ...ads]
    .sort((a, b) => new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime())
    .slice(0, limit);
}

export async function listForumAds() {
  return safeRows<LegacyRow>(`
    SELECT a.*, u.username
    FROM forum_ads a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.status IN ('approved', 'pending', 'awaiting_upload')
    ORDER BY a.created_at DESC
    LIMIT 80
  `);
}

export async function listMyForumThreads(userId: number) {
  return safeRows<LegacyRow>(`
    SELECT t.id, t.title, t.views, t.is_pinned, t.is_locked, t.status, t.created_at, f.name AS forum_name
    FROM forum_threads t
    LEFT JOIN forums f ON f.id = t.forum_id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
    LIMIT 80
  `, userId);
}

export async function getForumProfile(userId: number) {
  const profile = await safeOne<LegacyRow>(`
    SELECT id, username, fullname, avatar, cover_photo, role, rank, bio, post_count, created_at, last_activity, is_blue_tick
    FROM users
    WHERE id = ?
    LIMIT 1
  `, userId);
  if (!profile) return null;
  const [threads, posts] = await Promise.all([
    safeRows<LegacyRow>(`
      SELECT id, title, views, is_pinned, created_at
      FROM forum_threads
      WHERE user_id = ? AND status = 'active' AND COALESCE(is_deleted, 0) = 0
      ORDER BY created_at DESC
      LIMIT 20
    `, userId),
    safeRows<LegacyRow>(`
      SELECT p.id, p.thread_id, p.created_at, t.title
      FROM forum_posts p
      LEFT JOIN forum_threads t ON t.id = p.thread_id
      WHERE p.user_id = ? AND p.status = 'active' AND COALESCE(p.is_deleted, 0) = 0
      ORDER BY p.created_at DESC
      LIMIT 20
    `, userId),
  ]);
  return { profile, threads, posts };
}

export async function listForumFoldersForPosting() {
  return safeRows<LegacyRow>(`
    SELECT f.id, f.name, c.name AS category_name
    FROM forums f
    LEFT JOIN forum_categories c ON c.id = f.category_id
    ORDER BY c.priority ASC, f.priority ASC, f.name ASC
  `);
}

export async function createForumThread(userId: number, input: { forum_id: number; title: string; content: string }) {
  const slug = `${input.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      INSERT INTO forum_threads (forum_id, user_id, title, slug, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `, input.forum_id, userId, input.title, slug, now, now);
    const rows = await tx.$queryRawUnsafe<Array<{ id: number }>>('SELECT id FROM forum_threads WHERE user_id = ? ORDER BY id DESC LIMIT 1', userId);
    const threadId = Number(rows[0]?.id || 0);
    if (!threadId) throw new Error('Không tạo được thread');
    await tx.$executeRawUnsafe(`
      INSERT INTO forum_posts (thread_id, user_id, content, is_first_post, status, created_at, updated_at)
      VALUES (?, ?, ?, 1, 'pending', ?, ?)
    `, threadId, userId, input.content, now, now);
  });

  return safeOne<LegacyRow>('SELECT id, title FROM forum_threads WHERE user_id = ? ORDER BY id DESC LIMIT 1', userId);
}

export async function getSocialInbox(userId: number) {
  const [messages, friends, blocked] = await Promise.all([
    safeRows<LegacyRow>(`
      SELECT pm.*, su.username AS sender_username, ru.username AS receiver_username
      FROM private_messages pm
      LEFT JOIN users su ON su.id = pm.sender_id
      LEFT JOIN users ru ON ru.id = pm.receiver_id
      WHERE (pm.sender_id = ? OR pm.receiver_id = ?)
        AND COALESCE(pm.is_deleted, 0) = 0
      ORDER BY pm.created_at DESC
      LIMIT 80
    `, userId, userId),
    listSocialFriends(userId),
    safeRows<LegacyRow>(`
      SELECT b.*, u.username AS blocked_username
      FROM msg_blocks b
      LEFT JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = ?
      ORDER BY b.created_at DESC
    `, userId),
  ]);
  return { messages, friends, blocked };
}

export async function listSocialFriends(userId: number) {
  return safeRows<LegacyRow>(`
    SELECT
      f.*,
      CASE WHEN f.requester = ? THEN f.addressee ELSE f.requester END AS friend_id,
      u.username,
      u.fullname,
      u.avatar,
      u.rank,
      u.last_activity
    FROM friendships f
    LEFT JOIN users u ON u.id = CASE WHEN f.requester = ? THEN f.addressee ELSE f.requester END
    WHERE (f.requester = ? OR f.addressee = ?)
    ORDER BY f.updated_at DESC
    LIMIT 120
  `, userId, userId, userId, userId);
}

export async function getConversation(userId: number, otherUserId: number) {
  const [other, messages] = await Promise.all([
    safeOne<LegacyRow>('SELECT id, username, fullname, avatar, rank, status FROM users WHERE id = ? LIMIT 1', otherUserId),
    safeRows<LegacyRow>(`
      SELECT pm.*, su.username AS sender_username
      FROM private_messages pm
      LEFT JOIN users su ON su.id = pm.sender_id
      WHERE ((pm.sender_id = ? AND pm.receiver_id = ?) OR (pm.sender_id = ? AND pm.receiver_id = ?))
        AND COALESCE(pm.is_deleted, 0) = 0
      ORDER BY pm.created_at ASC
      LIMIT 200
    `, userId, otherUserId, otherUserId, userId),
  ]);
  return other ? { other, messages } : null;
}

export async function sendPrivateMessage(userId: number, receiverId: number, content: string) {
  await db.$executeRawUnsafe(`
    INSERT INTO private_messages (sender_id, receiver_id, content, is_read, created_at)
    VALUES (?, ?, ?, 0, NOW())
  `, userId, receiverId, content);
}

export async function createFriendRequest(userId: number, targetUserId: number) {
  if (!targetUserId || targetUserId === userId) {
    throw new Error('Người nhận không hợp lệ');
  }

  const target = await safeOne<LegacyRow>('SELECT id, username FROM users WHERE id = ? AND status = ? LIMIT 1', targetUserId, 'active');
  if (!target) {
    throw new Error('Không tìm thấy user đang hoạt động');
  }

  const existing = await safeOne<LegacyRow>(`
    SELECT *
    FROM friendships
    WHERE (requester = ? AND addressee = ?)
       OR (requester = ? AND addressee = ?)
    LIMIT 1
  `, userId, targetUserId, targetUserId, userId);

  if (existing) {
    await db.$executeRawUnsafe('UPDATE friendships SET status = ?, updated_at = NOW() WHERE id = ?', 'accepted', existing.id);
    return safeOne<LegacyRow>('SELECT * FROM friendships WHERE id = ? LIMIT 1', existing.id);
  }

  const nextId = await safeOne<LegacyRow>('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM friendships');
  await db.$executeRawUnsafe(`
    INSERT INTO friendships (id, requester, addressee, status, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', NOW(), NOW())
  `, Number(nextId?.next_id || 1), userId, targetUserId);

  return safeOne<LegacyRow>('SELECT * FROM friendships WHERE requester = ? AND addressee = ? ORDER BY updated_at DESC LIMIT 1', userId, targetUserId);
}

export async function getSellerDashboard(userId: number) {
  const [items, orders, sales, pendingWithdraw] = await Promise.all([
    safeRows<LegacyRow>(`
      SELECT *
      FROM game_market_items
      WHERE seller_id = ?
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT 80
    `, userId),
    safeRows<LegacyRow>(`
      SELECT o.*, i.title AS item_title, u.username AS buyer_username
      FROM game_market_orders o
      LEFT JOIN game_market_items i ON i.id = o.item_id
      LEFT JOIN users u ON u.id = o.buyer_id
      WHERE o.seller_id = ?
      ORDER BY o.created_at DESC
      LIMIT 80
    `, userId),
    safeCount('SELECT COUNT(*) AS total FROM game_market_orders WHERE seller_id = ? AND status = ?', userId, 'completed'),
    safeCount('SELECT COUNT(*) AS total FROM transactions WHERE user_id = ? AND type = ? AND status = ?', userId, 'withdraw', 'pending'),
  ]);

  const revenue = orders
    .filter((order) => String(order.status) === 'completed')
    .reduce((sum, order) => sum + toNumber(order.amount, 0), 0);

  return { items, orders, revenue, completedSales: sales, pendingWithdraw };
}

export async function listSellerOrders(userId: number) {
  return safeRows<LegacyRow>(`
    SELECT o.*, i.title AS item_title, i.category AS item_category, u.username AS buyer_username
    FROM game_market_orders o
    LEFT JOIN game_market_items i ON i.id = o.item_id
    LEFT JOIN users u ON u.id = o.buyer_id
    WHERE o.seller_id = ?
    ORDER BY o.created_at DESC
    LIMIT 120
  `, userId);
}

export async function listSellerWithdrawals(userId: number) {
  return safeRows<LegacyRow>(`
    SELECT *
    FROM transactions
    WHERE user_id = ? AND type = 'withdraw'
    ORDER BY created_at DESC
    LIMIT 80
  `, userId);
}

export async function createSellerWithdrawal(userId: number, amount: number, content: string) {
  const user = await db.users.findUnique({
    where: { id: userId },
    select: { balance: true },
  });

  if (!user) {
    throw new Error('Không tìm thấy user');
  }

  const normalizedAmount = Math.round(toNumber(amount, 0));
  if (normalizedAmount < 50000) {
    throw new Error('Số tiền rút tối thiểu là 50,000đ');
  }

  if (toNumber(user.balance, 0) < normalizedAmount) {
    throw new Error('Số dư không đủ để tạo yêu cầu rút');
  }

  return db.$transaction(async (tx) => {
    const nextBalance = toNumber(user.balance, 0) - normalizedAmount;
    await tx.users.update({
      where: { id: userId },
      data: { balance: nextBalance },
    });
    const transaction = await tx.transactions.create({
      data: {
        user_id: userId,
        amount: normalizedAmount,
        balance_after: nextBalance,
        type: 'withdraw',
        status: 'pending',
        content: content || `Yêu cầu rút ${normalizedAmount.toLocaleString('vi-VN')}đ`,
      },
    });
    await tx.activity_logs.create({
      data: {
        user_id: userId,
        activity: `Tạo yêu cầu rút tiền #${transaction.id}`,
      },
    }).catch(() => undefined);
    return normalizeLegacyRow(transaction as unknown as LegacyRow);
  });
}

export { processBankDepositByCode, processSePayDepositByCode };
