import 'server-only';

import { db } from '@/lib/db';
import {
  getGameMarketCategoryMeta,
  normalizeGameMarketCategory,
} from '@/lib/game-market-config';
import { collectGameMarketImageRefs, parseGameMarketImageRefs } from '@/lib/game-market-media';
import {
  GAME_MARKET_PLATFORM_FEE,
  getGameMarketListedPrice,
  normalizeGameMarketSellerPrice,
} from '@/lib/game-market-pricing';
import { getGameMarketPendingLikeStatus } from '@/lib/game-market-schema';
import { sendSocialMessage } from '@/lib/social';
import { toNumber } from '@/lib/utils';

type Row = Record<string, unknown>;
type RawExecutor = Pick<typeof db, '$queryRawUnsafe' | '$executeRawUnsafe'>;

function normalize<T extends Row>(row: T): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (typeof value === 'bigint') {
      return [key, Number(value)];
    }
    if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
      return [key, value.toNumber()];
    }
    return [key, value];
  })) as T;
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.ceil(value)))}đ`;
}

async function safeRows<T extends Row>(query: string, ...values: unknown[]) {
  try {
    const rows = await db.$queryRawUnsafe<T[]>(query, ...values);
    return rows.map(normalize);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[game-market-actions] query failed', error);
    }
    return [];
  }
}

async function safeOne<T extends Row>(query: string, ...values: unknown[]) {
  const rows = await safeRows<T>(query, ...values);
  return rows[0] || null;
}

function parseList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPersistableGameMarketThumbnailRef(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (/^data:/i.test(normalized) || normalized.length > 500) {
    return '';
  }

  return normalized;
}

async function getNextSequentialId(client: RawExecutor, table: 'game_market_items' | 'game_market_orders') {
  const rows = await client.$queryRawUnsafe<Array<{ next_id?: number | bigint }>>(
    `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${table}`
  );
  return Number(rows[0]?.next_id || 1);
}

function isDuplicateIdError(error: unknown) {
  return error instanceof Error && /duplicate entry/i.test(error.message);
}

export async function listGameMarketItems(limit = 36, category?: string) {
  const conditions = ["i.status = 'selling'"];
  const values: unknown[] = [];

  if (category && category !== 'all') {
    conditions.push('i.category = ?');
    values.push(normalizeGameMarketCategory(category));
  }

  values.push(limit);

  return safeRows<Row>(
    `
      SELECT
        i.*,
        u.username AS seller_username,
        u.rank AS seller_rank
      FROM game_market_items i
      LEFT JOIN users u ON u.id = i.seller_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.is_pinned DESC, i.created_at DESC
      LIMIT ?
    `,
    ...values
  );
}

export async function listGameMarketCategoryStats() {
  const rows = await safeRows<Row>(
    `
      SELECT category, COUNT(*) AS total
      FROM game_market_items
      WHERE status = 'selling'
      GROUP BY category
      ORDER BY total DESC, category ASC
    `
  );

  const aggregated = new Map<string, { slug: string; label: string; description: string; total: number }>();

  for (const row of rows) {
    const category = String(row.category || '');
    const meta = getGameMarketCategoryMeta(category);
    const current = aggregated.get(meta.slug) || {
      slug: meta.slug,
      label: meta.label,
      description: meta.description,
      total: 0,
    };
    current.total += Number(row.total || 0);
    aggregated.set(meta.slug, current);
  }

  return Array.from(aggregated.values()).sort((left, right) => right.total - left.total || left.label.localeCompare(right.label));
}

export async function listSellerGameItems(userId: number, limit = 12) {
  return safeRows<Row>(
    `
      SELECT *
      FROM game_market_items
      WHERE seller_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    userId,
    limit
  );
}

export async function getGameMarketDetail(itemId: number, userId?: number) {
  const [item, related, myOrders] = await Promise.all([
    safeOne<Row>(
      `
        SELECT
          i.*,
          u.username AS seller_username,
          u.rank AS seller_rank,
          u.avatar AS seller_avatar,
          u.last_activity AS seller_last_activity,
          u.status AS seller_status,
          (
            SELECT AVG(o.rating)
            FROM game_market_orders o
            WHERE o.item_id = i.id
              AND o.rating IS NOT NULL
              AND o.rating > 0
          ) AS average_rating
        FROM game_market_items i
        LEFT JOIN users u ON u.id = i.seller_id
        WHERE i.id = ?
          AND (
            i.status = 'selling'
            OR i.seller_id = ?
            OR EXISTS (
              SELECT 1
              FROM game_market_orders o
              WHERE o.item_id = i.id
                AND o.buyer_id = ?
            )
          )
        LIMIT 1
      `,
      itemId,
      userId || 0,
      userId || 0
    ),
    safeRows<Row>(
      `
        SELECT id, title, category, price, stock, badge, status
        FROM game_market_items
        WHERE id <> ?
          AND status = 'selling'
        ORDER BY is_pinned DESC, created_at DESC
        LIMIT 6
      `,
      itemId
    ),
    userId ? safeRows<Row>(
      `
        SELECT id, amount, status, rating, review, created_at
        FROM game_market_orders
        WHERE buyer_id = ? AND item_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `,
      userId,
      itemId
    ) : Promise.resolve([]),
  ]);

  if (!item) {
    return null;
  }

  return {
    item,
    related,
    myOrders,
  };
}

export async function getGameMarketChatContext(itemId: number) {
  const item = await safeOne<Row>(
    `
      SELECT
        i.id,
        i.title,
        i.category,
        i.price,
        i.stock,
        i.status,
        i.seller_id,
        u.username AS seller_username,
        u.fullname AS seller_fullname,
        u.last_activity AS seller_last_activity
      FROM game_market_items i
      LEFT JOIN users u ON u.id = i.seller_id
      WHERE i.id = ?
      LIMIT 1
    `,
    itemId
  );

  return item;
}

export async function createOrUpdateGameItem(userId: number, input: {
  itemId?: number;
  title: string;
  category: string;
  tag?: string;
  badge?: string;
  badgeColor?: string;
  price: number;
  stock: number;
  prepTime?: string;
  originalPrice?: number;
  thumbnail?: string;
  description: string;
  images?: string;
  features?: string;
  rank?: string;
  skins?: string;
  champs?: string;
  accountDetails?: string;
  deliveryMethod?: string;
}) {
  const imageRefs = parseGameMarketImageRefs(String(input.images || ''));
  if (imageRefs.length > 3) {
    throw new Error('Mỗi bài đăng chỉ được tối đa 3 ảnh');
  }

  const thumbnail = collectGameMarketImageRefs({
    thumbnail: input.thumbnail,
    images: imageRefs,
  }, 1)[0] || '';
  const sellerPrice = normalizeGameMarketSellerPrice(input.price || 0);
  const isUpdate = Boolean(input.itemId);

  const payload = {
    title: input.title.trim(),
    category: normalizeGameMarketCategory(input.category.trim() || 'steam-khac'),
    tag: String(input.tag || '').trim(),
    badge: String(input.badge || '').trim(),
    badgeColor: String(input.badgeColor || '').trim(),
    price: isUpdate ? sellerPrice : getGameMarketListedPrice(sellerPrice),
    stock: Math.max(1, Math.min(9999, Math.round(input.stock || 1))),
    prepTime: String(input.prepTime || '').trim(),
    originalPrice: input.originalPrice ? Math.round(input.originalPrice) : null,
    thumbnail: getPersistableGameMarketThumbnailRef(thumbnail),
    description: input.description.trim(),
    images: JSON.stringify(imageRefs),
    features: JSON.stringify(parseList(String(input.features || ''))),
    rank: String(input.rank || '').trim(),
    skins: String(input.skins || '').trim(),
    champs: String(input.champs || '').trim(),
    accountDetails: String(input.accountDetails || '').trim(),
    deliveryMethod: String(input.deliveryMethod || 'manual').trim(),
  };

  if (payload.title.length < 6 || payload.description.length < 20) {
    throw new Error('Tiêu đề hoặc mô tả sản phẩm quá ngắn');
  }

  const pendingLikeStatus = await getGameMarketPendingLikeStatus();

  if (input.itemId) {
    const owned = await safeOne<Row>('SELECT id FROM game_market_items WHERE id = ? AND seller_id = ? LIMIT 1', input.itemId, userId);
    if (!owned) {
      throw new Error('Không tìm thấy sản phẩm để cập nhật');
    }

    await db.$executeRawUnsafe(
      `
        UPDATE game_market_items
        SET title = ?, category = ?, tag = ?, badge = ?, badge_color = ?, price = ?, stock = ?, prep_time = ?, original_price = ?, thumbnail = ?, description = ?, images = ?, features = ?, rank = ?, skins = ?, champs = ?, account_details = ?, delivery_method = ?, status = ?, is_pinned = 0, pinned_until = NULL, updated_at = NOW()
        WHERE id = ? AND seller_id = ?
      `,
      payload.title,
      payload.category,
      payload.tag || null,
      payload.badge || null,
      payload.badgeColor || null,
      payload.price,
      payload.stock,
      payload.prepTime || null,
      payload.originalPrice,
      payload.thumbnail || null,
      payload.description,
      payload.images,
      payload.features,
      payload.rank || null,
      payload.skins || null,
      payload.champs || null,
      payload.accountDetails || null,
      payload.deliveryMethod || 'manual',
      pendingLikeStatus,
      input.itemId,
      userId
    );

    return {
      id: input.itemId,
      status: pendingLikeStatus,
      price: payload.price,
      sellerPrice,
      platformFee: 0,
    };
  }

  const code = `GM${Date.now()}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextId = await getNextSequentialId(db, 'game_market_items');

    try {
      await db.$executeRawUnsafe(
        `
          INSERT INTO game_market_items (id, code, seller_id, title, category, tag, badge, badge_color, price, stock, prep_time, accounts_stock, original_price, thumbnail, description, images, features, rank, skins, champs, account_details, status, delivery_method, created_at, updated_at, is_pinned)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0)
        `,
        nextId,
        code,
        userId,
        payload.title,
        payload.category,
        payload.tag || null,
        payload.badge || null,
        payload.badgeColor || null,
        payload.price,
        payload.stock,
        payload.prepTime || null,
        payload.stock,
        payload.originalPrice,
        payload.thumbnail || null,
        payload.description,
        payload.images,
        payload.features,
        payload.rank || null,
        payload.skins || null,
        payload.champs || null,
        payload.accountDetails || null,
        pendingLikeStatus,
        payload.deliveryMethod || 'manual'
      );

      return {
        id: nextId,
        status: pendingLikeStatus,
        price: payload.price,
        sellerPrice,
        platformFee: GAME_MARKET_PLATFORM_FEE,
      };
    } catch (error) {
      if (attempt < 2 && isDuplicateIdError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Không thể tạo ID mới cho bài game-market');
}

export async function setGameItemState(userId: number, itemId: number, action: 'pin' | 'unpin' | 'hide') {
  const owned = await safeOne<Row>('SELECT id, status FROM game_market_items WHERE id = ? AND seller_id = ? LIMIT 1', itemId, userId);
  if (!owned) {
    throw new Error('Không tìm thấy sản phẩm để thao tác');
  }

  if (action === 'hide') {
    await db.$executeRawUnsafe(
      `
        UPDATE game_market_items
        SET status = 'hidden', updated_at = NOW()
        WHERE id = ? AND seller_id = ?
      `,
      itemId,
      userId
    );
    return { success: true };
  }

  if (String(owned.status || '') !== 'selling') {
    throw new Error('Chỉ có thể ghim bài đã được duyệt và đang hiển thị');
  }

  await db.$executeRawUnsafe(
    `
      UPDATE game_market_items
      SET is_pinned = ?, pinned_until = ?, updated_at = NOW()
      WHERE id = ? AND seller_id = ?
    `,
    action === 'pin' ? 1 : 0,
    action === 'pin' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
    itemId,
    userId
  );
  return { success: true };
}

export async function purchaseGameItem(userId: number, itemId: number) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await db.$transaction(async (tx) => {
        const items = await tx.$queryRawUnsafe<Array<Row>>(
          `
            SELECT id, seller_id, title, price, stock
            FROM game_market_items
            WHERE id = ?
              AND status = 'selling'
            LIMIT 1
            FOR UPDATE
          `,
          itemId
        );
        const item = normalize(items[0] || {});
        if (!item.id) {
          throw new Error('Không tìm thấy sản phẩm');
        }

        if (Number(item.seller_id || 0) === userId) {
          throw new Error('Bạn không thể tự mua sản phẩm của chính mình');
        }

        if (toNumber(item.stock, 0) <= 0) {
          throw new Error('Sản phẩm đã hết hàng');
        }

        const buyer = await tx.users.findUnique({
          where: { id: userId },
          select: { game_balance: true },
        });
        if (!buyer) {
          throw new Error('Không tìm thấy tài khoản người mua');
        }

        const price = toNumber(item.price, 0);
        const nextBalance = toNumber(buyer.game_balance, 0) - price;
        if (nextBalance < 0) {
          throw new Error(`Ví game không đủ. Vui lòng nạp thêm ${formatVnd(Math.abs(nextBalance))} để mua sản phẩm này.`);
        }

        await tx.users.update({
          where: { id: userId },
          data: { game_balance: nextBalance, last_activity: new Date() },
        });

        await tx.transactions.create({
          data: {
            user_id: userId,
            amount: price,
            balance_after: nextBalance,
            wallet_type: 'game',
            type: 'order',
            status: 'success',
            content: `Mua game account #${itemId} bằng ví game`,
          },
        }).catch(() => undefined);

        const status = 'processing';
        const nextOrderId = await getNextSequentialId(tx, 'game_market_orders');

        await tx.$executeRawUnsafe(
          `
            INSERT INTO game_market_orders (id, buyer_id, seller_id, item_id, stock_id, amount, delivered_data, status, created_at)
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?, NOW())
          `,
          nextOrderId,
          userId,
          item.seller_id,
          itemId,
          price,
          '',
          status
        );

        await tx.$executeRawUnsafe(
          `
            UPDATE game_market_items
            SET stock = GREATEST(stock - 1, 0),
                status = CASE WHEN stock - 1 <= 0 THEN 'sold' ELSE status END,
                updated_at = NOW()
            WHERE id = ?
          `,
          itemId
        );
        const orderId = nextOrderId;

        return {
          orderId,
          status,
          sellerId: Number(item.seller_id || 0),
          sellerUsername: '',
          itemTitle: String(item.title || `Game #${itemId}`),
          itemId,
        };
      });

      void db.activity_logs.create({
        data: {
          user_id: userId,
          activity: `Mua sản phẩm game-market #${itemId}, order #${result.orderId}`,
        },
      }).catch(() => undefined);

      if (result.sellerId > 0) {
        void sendSocialMessage({
          senderId: userId,
          receiverId: result.sellerId,
          content: `Mình vừa mua bài "${result.itemTitle}" (order #${result.orderId}). Bạn vui lòng bàn giao tài khoản, mật khẩu và thông tin liên quan qua đoạn chat này giúp mình nhé.`,
        }).catch(() => undefined);
      }

      return result;
    } catch (error) {
      lastError = error;
      if (attempt < 2 && isDuplicateIdError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Không thể tạo order game-market');
}

export async function rateGameOrder(userId: number, orderId: number, rating: number, review: string) {
  const normalizedRating = Math.max(1, Math.min(5, Math.trunc(rating || 5)));
  await db.$executeRawUnsafe(
    `
      UPDATE game_market_orders
      SET rating = ?, review = ?
      WHERE id = ? AND buyer_id = ?
    `,
    normalizedRating,
    review.slice(0, 2000),
    orderId,
    userId
  );
  return { success: true };
}

export async function completeGameOrder(userId: number, orderId: number) {
  const order = await safeOne<Row>(
    `
      SELECT id, seller_id, buyer_id, item_id, status
      FROM game_market_orders
      WHERE id = ?
      LIMIT 1
    `,
    orderId
  );

  if (!order) {
    throw new Error('Không tìm thấy đơn game-market');
  }

  if (Number(order.seller_id || 0) !== userId) {
    throw new Error('Bạn không có quyền cập nhật đơn hàng này');
  }

  if (String(order.status || '').toLowerCase() === 'completed') {
    return { success: true, orderId, status: 'completed' };
  }

  await db.$executeRawUnsafe(
    `
      UPDATE game_market_orders
      SET status = 'completed'
      WHERE id = ? AND seller_id = ?
    `,
    orderId,
    userId
  );

  await db.$executeRawUnsafe(
    `
      INSERT INTO notifications (user_id, from_user_id, type, message, link, is_read, created_at)
      VALUES (?, ?, 'game_market_delivery', ?, ?, 0, NOW())
    `,
    Number(order.buyer_id || 0),
    userId,
    `Seller đã xác nhận bàn giao xong cho đơn game #${orderId}. Bạn có thể mở chat để kiểm tra lại thông tin.`,
    `/user/game-market/${Number(order.item_id || 0)}`
  ).catch(() => undefined);

  return { success: true, orderId, status: 'completed' };
}
