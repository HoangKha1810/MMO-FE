import { db } from '@/lib/db';

export interface ForumCategorySummary {
  id: number;
  name: string;
  description: string | null;
  priority: number;
  forums_count: number;
  threads_count: number;
}

export interface ForumThreadSummary {
  id: number;
  user_id: number;
  forum_id: number;
  title: string;
  slug: string | null;
  content: string;
  views: number;
  replies: number;
  is_pinned: number | boolean;
  is_locked: number | boolean;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  forum_name: string | null;
  forum_slug: string | null;
  category_name: string | null;
  username: string | null;
  avatar: string | null;
}

export interface ForumFolderSummary {
  id: number;
  category_id: number;
  parent_id: number | null;
  name: string;
  slug: string | null;
  description: string | null;
  icon: string | null;
  priority: number;
  threads_count: number;
  posts_count: number;
}

export interface ForumPostSummary {
  id: number;
  thread_id: number;
  user_id: number;
  content: string;
  is_first_post: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
  status: string;
  username: string | null;
  role: string | null;
  avatar: string | null;
  is_blue_tick: number | boolean | null;
  blue_tick_expiry: Date | string | null;
  user_posts_count: number;
  total_reactions: number;
}

interface CountRow {
  total: number | bigint;
}

export const ACTIVE_FORUM_STATUSES = ['active', 'approved', 'open', 'published'] as const;
export const VISIBLE_FORUM_STATUSES = [...ACTIVE_FORUM_STATUSES, 'pending', 'rejected', 'hidden'] as const;
const ACTIVE_FORUM_STATUS_SQL = "'active', 'approved', 'open', 'published'";
const VISIBLE_FORUM_STATUS_SQL = "'active', 'approved', 'open', 'published', 'pending', 'rejected', 'hidden'";

export function forumVietnamTimestampSql(column: string) {
  return `DATE_FORMAT(DATE_ADD('1970-01-01 00:00:00', INTERVAL (UNIX_TIMESTAMP(${column}) + 25200) SECOND), '%Y-%m-%d %H:%i:%s')`;
}

const FORUM_GAMBLING_PATTERNS = [
  /\bcasino\b/i,
  /\bbaccarat\b/i,
  /\bbet(?:ting)?\b/i,
  /\bc[ao]\s*bac\b/i,
  /\bdanh\s*bac\b/i,
  /\bca\s*cuoc\b/i,
  /\bkeo\s*nh[aà]\s*cai\b/i,
  /\btai\s*xiu\b/i,
  /\bt[aà]i\s*x[iỉ]u\b/i,
  /\bx[oó]c\s*d[iĩ]a\b/i,
  /\bn[oô]\s*h[uũ]\b/i,
  /\bslot\b/i,
  /\bgame\s*b[aà]i\b/i,
  /\ban\s*tien\b/i,
  /\btien\s*cao\b/i,
  /\bthe\s*cao\b/i,
  /\bnh[aà]\s*c[aá]i\b/i,
  /\bc[áa]\s*c[ưừ]ơc\b/i,
  /\bcờ\s*bạc\b/i,
];

const FORUM_GAMBLING_SQL_FILTER = `
  AND LOWER(CONCAT(COALESCE(t.title, ''), ' ', COALESCE(fp.content, ''))) NOT REGEXP
    'casino|baccarat|betting|\\\\bbet\\\\b|c[ao] bac|cờ bạc|danh bac|đánh bạc|ca cuoc|cá cược|keo nha cai|kèo nhà cái|tai xiu|tài xỉu|xoc dia|xóc đĩa|no hu|nổ hũ|slot|game bai|game bài|an tien|ăn tiền|tien cao|tiền cào|the cao|thẻ cào|nha cai|nhà cái'
`;

export function isActiveForumStatus(status: unknown) {
  const normalized = String(status || 'active').trim().toLowerCase();
  return ACTIVE_FORUM_STATUSES.includes(normalized as typeof ACTIVE_FORUM_STATUSES[number]);
}

export function containsForumGamblingContent(value: unknown) {
  const text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return FORUM_GAMBLING_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildForumModerationText(input: { title?: unknown; content?: unknown }) {
  return `${String(input.title || '')}\n${String(input.content || '')}`;
}

function toCount(value: unknown) {
  return Number(value || 0);
}

export async function getForumOverview() {
  try {
    const [categories, threads, postsCount, usersCount] = await Promise.all([
      db.$queryRawUnsafe<ForumCategorySummary[]>(`
        SELECT
          c.id,
          c.name,
          c.description,
          c.priority,
          COUNT(DISTINCT f.id) AS forums_count,
          COUNT(t.id) AS threads_count
        FROM forum_categories c
        LEFT JOIN forums f ON f.category_id = c.id
        LEFT JOIN forum_threads t
          ON t.forum_id = f.id
          AND t.status IN (${ACTIVE_FORUM_STATUS_SQL})
          AND COALESCE(t.is_deleted, 0) = 0
        GROUP BY c.id, c.name, c.description, c.priority
        ORDER BY c.priority ASC, c.id ASC
      `),
      db.$queryRawUnsafe<ForumThreadSummary[]>(`
        SELECT
          t.id,
          t.user_id,
          t.forum_id,
          t.title,
          t.slug,
          COALESCE(fp.content, '') AS content,
          t.views,
          COALESCE(reply_counts.replies, 0) AS replies,
          t.is_pinned,
          t.is_locked,
          t.status,
          ${forumVietnamTimestampSql('t.created_at')} AS created_at,
          ${forumVietnamTimestampSql('t.updated_at')} AS updated_at,
          f.name AS forum_name,
          f.slug AS forum_slug,
          c.name AS category_name,
          u.username,
          u.avatar
        FROM forum_threads t
        LEFT JOIN forums f ON f.id = t.forum_id
        LEFT JOIN forum_categories c ON c.id = f.category_id
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN forum_posts fp ON fp.id = (
          SELECT p.id
          FROM forum_posts p
          WHERE p.thread_id = t.id
            AND p.is_first_post = 1
            AND COALESCE(p.is_deleted, 0) = 0
          ORDER BY p.id ASC
          LIMIT 1
        )
        LEFT JOIN (
          SELECT thread_id, COUNT(*) AS replies
          FROM forum_posts
          WHERE is_first_post = 0
            AND status IN (${ACTIVE_FORUM_STATUS_SQL})
            AND COALESCE(is_deleted, 0) = 0
          GROUP BY thread_id
        ) reply_counts ON reply_counts.thread_id = t.id
        WHERE t.status IN (${ACTIVE_FORUM_STATUS_SQL})
          AND COALESCE(t.is_deleted, 0) = 0
          ${FORUM_GAMBLING_SQL_FILTER}
        ORDER BY t.is_pinned DESC, t.updated_at DESC, t.created_at DESC
        LIMIT 30
      `),
      db.$queryRawUnsafe<CountRow[]>(`
        SELECT COUNT(*) AS total
        FROM forum_posts
        WHERE status IN (${ACTIVE_FORUM_STATUS_SQL})
          AND COALESCE(is_deleted, 0) = 0
      `),
      db.$queryRawUnsafe<CountRow[]>('SELECT COUNT(*) AS total FROM users'),
    ]);

    return {
      categories: categories.map((category) => ({
        ...category,
        id: Number(category.id),
        priority: Number(category.priority || 0),
        forums_count: toCount(category.forums_count),
        threads_count: toCount(category.threads_count),
      })),
      threads: threads.map(normalizeThread),
      totalPosts: toCount(postsCount[0]?.total),
      totalUsers: toCount(usersCount[0]?.total),
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[forum] Falling back to empty forum overview.', error);
    }

    return {
      categories: [] as ForumCategorySummary[],
      threads: [] as ForumThreadSummary[],
      totalPosts: 0,
      totalUsers: 0,
    };
  }
}

function normalizeThread(thread: ForumThreadSummary): ForumThreadSummary {
  return {
    ...thread,
    id: Number(thread.id),
    user_id: Number(thread.user_id),
    forum_id: Number(thread.forum_id),
    content: forumPlainText(thread.content),
    views: toCount(thread.views),
    replies: toCount(thread.replies),
  };
}

function normalizeFolder(folder: ForumFolderSummary): ForumFolderSummary {
  return {
    ...folder,
    id: Number(folder.id),
    category_id: Number(folder.category_id),
    parent_id: folder.parent_id === null ? null : Number(folder.parent_id),
    priority: Number(folder.priority || 0),
    threads_count: toCount(folder.threads_count),
    posts_count: toCount(folder.posts_count),
  };
}

const SAFE_FORUM_HTML_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h2',
  'h3',
  'h4',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul',
]);

const VOID_FORUM_HTML_TAGS = new Set(['br', 'img']);

function escapeForumHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeForumUrl(value: string) {
  const url = value.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '');
  if (!url) return false;
  if (/^(javascript|data|vbscript|file|blob):/i.test(url)) return false;
  return /^(https?:\/\/|\/(?!\/)|\.{0,2}\/|#)/i.test(url);
}

function safeForumAttribute(tag: string, name: string, value: string) {
  const attr = name.toLowerCase();
  if (attr.startsWith('on') || attr === 'style' || attr === 'srcdoc' || attr.includes(':')) {
    return '';
  }

  const escaped = escapeForumHtml(value.trim()).replace(/`/g, '&#96;');
  if (tag === 'a' && attr === 'href' && isSafeForumUrl(value)) {
    return ` href="${escaped}" target="_blank" rel="nofollow noopener noreferrer"`;
  }
  if (tag === 'img') {
    if (attr === 'src' && isSafeForumUrl(value)) {
      return ` src="${escaped}" loading="lazy" decoding="async" referrerpolicy="no-referrer"`;
    }
    if (attr === 'alt') {
      return ` alt="${escaped.slice(0, 160)}"`;
    }
  }

  return '';
}

function sanitizeForumTag(tagSource: string, tagName: string) {
  const tag = tagName.toLowerCase();
  if (!SAFE_FORUM_HTML_TAGS.has(tag)) {
    return '';
  }
  if (tagSource.startsWith('</')) {
    return VOID_FORUM_HTML_TAGS.has(tag) ? '' : `</${tag}>`;
  }

  let attrs = '';
  tagSource.replace(
    /\s([a-zA-Z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'<>`]+))/g,
    (_match, attrName: string, _raw: string, quotedDouble: string, quotedSingle: string, unquoted: string) => {
      attrs += safeForumAttribute(tag, attrName, quotedDouble ?? quotedSingle ?? unquoted ?? '');
      return '';
    }
  );

  return VOID_FORUM_HTML_TAGS.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>`;
}

export function cleanForumHtml(html: string | null | undefined) {
  const value = String(html || '').trim();
  if (!value) return '';

  const stripped = value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\s*(iframe|object|embed|svg|math|template|form|input|button|textarea|select|option|link|meta)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|svg|math|template|form|input|button|textarea|select|option|link|meta)[^>]*\/?\s*>/gi, '');

  if (!/<\/?[a-z][\s\S]*>/i.test(stripped)) {
    return escapeForumHtml(stripped)
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  return stripped
    .replace(/<\s*\/?\s*([a-zA-Z0-9:-]+)(?:\s[^>]*)?\s*\/?>/g, (fullTag, tagName) => sanitizeForumTag(fullTag, tagName))
    .trim();
}

export function forumPlainText(html: string | null | undefined) {
  return cleanForumHtml(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const threadSelectSql = `
  SELECT
    t.id,
    t.user_id,
    t.forum_id,
    t.title,
    t.slug,
    COALESCE(fp.content, '') AS content,
    t.views,
    COALESCE(reply_counts.replies, 0) AS replies,
    t.is_pinned,
    t.is_locked,
    t.status,
    ${forumVietnamTimestampSql('t.created_at')} AS created_at,
    ${forumVietnamTimestampSql('t.updated_at')} AS updated_at,
    f.name AS forum_name,
    f.slug AS forum_slug,
    c.name AS category_name,
    u.username,
    u.avatar
  FROM forum_threads t
  LEFT JOIN forums f ON f.id = t.forum_id
  LEFT JOIN forum_categories c ON c.id = f.category_id
  LEFT JOIN users u ON u.id = t.user_id
  LEFT JOIN forum_posts fp ON fp.id = (
    SELECT p.id
    FROM forum_posts p
    WHERE p.thread_id = t.id
      AND p.is_first_post = 1
      AND COALESCE(p.is_deleted, 0) = 0
    ORDER BY p.id ASC
    LIMIT 1
  )
  LEFT JOIN (
    SELECT thread_id, COUNT(*) AS replies
    FROM forum_posts
    WHERE is_first_post = 0
      AND status IN (${ACTIVE_FORUM_STATUS_SQL})
      AND COALESCE(is_deleted, 0) = 0
    GROUP BY thread_id
  ) reply_counts ON reply_counts.thread_id = t.id
`;

export async function getForumCategoryDetails(categoryId: number) {
  try {
    const [categoryRows, folders, threads] = await Promise.all([
      db.$queryRawUnsafe<ForumCategorySummary[]>(
        'SELECT id, name, description, priority, 0 AS forums_count, 0 AS threads_count FROM forum_categories WHERE id = ? LIMIT 1',
        categoryId
      ),
      db.$queryRawUnsafe<ForumFolderSummary[]>(`
        SELECT
          f.id,
          f.category_id,
          f.parent_id,
          f.name,
          f.slug,
          f.description,
          f.icon,
          f.priority,
          COUNT(DISTINCT t.id) AS threads_count,
          COUNT(p.id) AS posts_count
        FROM forums f
        LEFT JOIN forum_threads t
          ON t.forum_id = f.id
          AND t.status IN (${ACTIVE_FORUM_STATUS_SQL})
          AND COALESCE(t.is_deleted, 0) = 0
        LEFT JOIN forum_posts p
          ON p.thread_id = t.id
          AND p.status IN (${ACTIVE_FORUM_STATUS_SQL})
          AND COALESCE(p.is_deleted, 0) = 0
        WHERE f.category_id = ?
        GROUP BY f.id, f.category_id, f.parent_id, f.name, f.slug, f.description, f.icon, f.priority
        ORDER BY f.priority ASC, f.id ASC
      `, categoryId),
      db.$queryRawUnsafe<ForumThreadSummary[]>(`
        ${threadSelectSql}
        WHERE f.category_id = ?
          AND t.status IN (${ACTIVE_FORUM_STATUS_SQL})
          AND COALESCE(t.is_deleted, 0) = 0
          ${FORUM_GAMBLING_SQL_FILTER}
        ORDER BY t.is_pinned DESC, t.updated_at DESC, t.created_at DESC
        LIMIT 80
      `, categoryId),
    ]);

    const category = categoryRows[0];
    if (!category) {
      return null;
    }

    return {
      category: {
        ...category,
        id: Number(category.id),
        priority: Number(category.priority || 0),
      },
      folders: folders.map(normalizeFolder),
      threads: threads.map(normalizeThread),
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[forum] Failed to load category.', error);
    }
    return null;
  }
}

export async function getForumFolderDetails(forumId: number) {
  try {
    const [forumRows, threads] = await Promise.all([
      db.$queryRawUnsafe<Array<ForumFolderSummary & { category_name: string | null }>>(`
        SELECT
          f.id,
          f.category_id,
          f.parent_id,
          f.name,
          f.slug,
          f.description,
          f.icon,
          f.priority,
          c.name AS category_name,
          0 AS threads_count,
          0 AS posts_count
        FROM forums f
        LEFT JOIN forum_categories c ON c.id = f.category_id
        WHERE f.id = ?
        LIMIT 1
      `, forumId),
      db.$queryRawUnsafe<ForumThreadSummary[]>(`
        ${threadSelectSql}
        WHERE t.forum_id = ?
          AND t.status IN (${ACTIVE_FORUM_STATUS_SQL})
          AND COALESCE(t.is_deleted, 0) = 0
          ${FORUM_GAMBLING_SQL_FILTER}
        ORDER BY t.is_pinned DESC, t.updated_at DESC, t.created_at DESC
        LIMIT 80
      `, forumId),
    ]);

    const forum = forumRows[0];
    if (!forum) {
      return null;
    }

    return {
      forum: normalizeFolder(forum),
      categoryName: forum.category_name,
      threads: threads.map(normalizeThread),
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[forum] Failed to load forum folder.', error);
    }
    return null;
  }
}

export async function getForumThreadDetails(threadId: number, viewerId?: number, viewerRole?: string | null) {
  try {
    const isAdminViewer = String(viewerRole || '').toLowerCase() === 'admin';
    const threadVisibilitySql = isAdminViewer
      ? `AND t.status IN (${VISIBLE_FORUM_STATUS_SQL})`
      : viewerId
        ? `AND (t.status IN (${ACTIVE_FORUM_STATUS_SQL}) OR t.user_id = ?)`
        : `AND t.status IN (${ACTIVE_FORUM_STATUS_SQL})`;
    const threadVisibilityParams = !isAdminViewer && viewerId ? [viewerId] : [];

    const threadRows = await db.$queryRawUnsafe<ForumThreadSummary[]>(`
      ${threadSelectSql}
      WHERE t.id = ?
        ${threadVisibilitySql}
        AND COALESCE(t.is_deleted, 0) = 0
        ${isAdminViewer ? '' : FORUM_GAMBLING_SQL_FILTER}
      LIMIT 1
    `, threadId, ...threadVisibilityParams);

    const thread = threadRows[0];
    if (!thread) {
      return null;
    }

    await db.$executeRawUnsafe('UPDATE forum_threads SET views = views + 1 WHERE id = ?', threadId).catch(() => null);

    const postVisibilitySql = isAdminViewer
      ? `AND p.status IN (${VISIBLE_FORUM_STATUS_SQL})`
      : viewerId
        ? `AND (p.status IN (${ACTIVE_FORUM_STATUS_SQL}) OR p.user_id = ?)`
        : `AND p.status IN (${ACTIVE_FORUM_STATUS_SQL})`;
    const postVisibilityParams = !isAdminViewer && viewerId ? [viewerId] : [];

    const posts = await db.$queryRawUnsafe<ForumPostSummary[]>(`
      SELECT
        p.id,
        p.thread_id,
        p.user_id,
        p.content,
        p.is_first_post,
        ${forumVietnamTimestampSql('p.created_at')} AS created_at,
        ${forumVietnamTimestampSql('p.updated_at')} AS updated_at,
        p.status,
        u.username,
        u.role,
        u.avatar,
        u.is_blue_tick,
        u.blue_tick_expiry,
        (
          SELECT COUNT(*)
          FROM forum_posts p2
          WHERE p2.user_id = u.id
            AND p2.status IN (${ACTIVE_FORUM_STATUS_SQL})
            AND COALESCE(p2.is_deleted, 0) = 0
        ) AS user_posts_count,
        (
          SELECT COUNT(*)
          FROM forum_reactions r
          WHERE r.post_id = p.id
        ) AS total_reactions
      FROM forum_posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.thread_id = ?
        ${postVisibilitySql}
        AND COALESCE(p.is_deleted, 0) = 0
      ORDER BY p.created_at ASC, p.id ASC
    `, threadId, ...postVisibilityParams);

    return {
      thread: normalizeThread({ ...thread, views: Number(thread.views || 0) + 1 }),
      posts: posts.map((post) => ({
        ...post,
        id: Number(post.id),
        thread_id: Number(post.thread_id),
        user_id: Number(post.user_id),
        user_posts_count: toCount(post.user_posts_count),
        total_reactions: toCount(post.total_reactions),
        content: cleanForumHtml(post.content),
      })),
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[forum] Failed to load thread.', error);
    }
    return null;
  }
}
