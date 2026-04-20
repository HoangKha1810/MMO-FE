import 'server-only';

import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

type Row = Record<string, unknown>;

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

export async function listGameMarketItems(limit = 36) {
  return safeRows<Row>(
    `
      SELECT
        i.*,
        u.username AS seller_username,
        u.rank AS seller_rank
      FROM game_market_items i
      LEFT JOIN users u ON u.id = i.seller_id
      WHERE i.status = 'selling'
      ORDER BY i.is_pinned DESC, i.created_at DESC
      LIMIT ?
    `,
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
        LIMIT 1
      `,
      itemId
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
  const payload = {
    title: input.title.trim(),
    category: input.category.trim() || 'general',
    tag: String(input.tag || '').trim(),
    badge: String(input.badge || '').trim(),
    badgeColor: String(input.badgeColor || '').trim(),
    price: Math.max(1000, Math.round(input.price || 0)),
    stock: Math.max(1, Math.min(9999, Math.round(input.stock || 1))),
    prepTime: String(input.prepTime || '').trim(),
    originalPrice: input.originalPrice ? Math.round(input.originalPrice) : null,
    thumbnail: String(input.thumbnail || '').trim(),
    description: input.description.trim(),
    images: JSON.stringify(parseList(String(input.images || ''))),
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

  if (input.itemId) {
    const owned = await safeOne<Row>('SELECT id FROM game_market_items WHERE id = ? AND seller_id = ? LIMIT 1', input.itemId, userId);
    if (!owned) {
      throw new Error('Không tìm thấy sản phẩm để cập nhật');
    }

    await db.$executeRawUnsafe(
      `
        UPDATE game_market_items
        SET title = ?, category = ?, tag = ?, badge = ?, badge_color = ?, price = ?, stock = ?, prep_time = ?, original_price = ?, thumbnail = ?, description = ?, images = ?, features = ?, rank = ?, skins = ?, champs = ?, account_details = ?, delivery_method = ?, updated_at = NOW()
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
      input.itemId,
      userId
    );

    return { id: input.itemId };
  }

  const code = `GM${Date.now()}`;
  await db.$executeRawUnsafe(
    `
      INSERT INTO game_market_items (code, seller_id, title, category, tag, badge, badge_color, price, stock, prep_time, accounts_stock, original_price, thumbnail, description, images, features, rank, skins, champs, account_details, status, delivery_method, created_at, updated_at, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'selling', ?, NOW(), NOW(), 0)
    `,
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
    payload.deliveryMethod || 'manual'
  );

  const inserted = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
  return { id: Number(inserted[0]?.id || 0) };
}

export async function setGameItemState(userId: number, itemId: number, action: 'pin' | 'unpin' | 'hide') {
  const owned = await safeOne<Row>('SELECT id FROM game_market_items WHERE id = ? AND seller_id = ? LIMIT 1', itemId, userId);
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
  return db.$transaction(async (tx) => {
    const items = await tx.$queryRawUnsafe<Array<Row>>(
      `
        SELECT *
        FROM game_market_items
        WHERE id = ?
          AND status = 'selling'
        LIMIT 1
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
      select: { balance: true },
    });
    if (!buyer) {
      throw new Error('Không tìm thấy tài khoản người mua');
    }

    const price = toNumber(item.price, 0);
    const nextBalance = toNumber(buyer.balance, 0) - price;
    if (nextBalance < 0) {
      throw new Error('Số dư không đủ để mua game');
    }

    await tx.users.update({
      where: { id: userId },
      data: { balance: nextBalance, last_activity: new Date() },
    });

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: price,
        balance_after: nextBalance,
        type: 'order',
        status: 'success',
        content: `Mua game account #${itemId}`,
      },
    }).catch(() => undefined);

    const status = String(item.delivery_method || 'manual').toLowerCase() === 'manual' && !String(item.account_details || '').trim()
      ? 'processing'
      : 'completed';

    await tx.$executeRawUnsafe(
      `
        INSERT INTO game_market_orders (buyer_id, seller_id, item_id, stock_id, amount, delivered_data, status, created_at)
        VALUES (?, ?, ?, NULL, ?, ?, ?, NOW())
      `,
      userId,
      item.seller_id,
      itemId,
      price,
      String(item.account_details || ''),
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

    const inserted = await tx.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
    const orderId = Number(inserted[0]?.id || 0);

    await tx.activity_logs.create({
      data: {
        user_id: userId,
        activity: `Mua sản phẩm game-market #${itemId}, order #${orderId}`,
      },
    }).catch(() => undefined);

    return { orderId, status };
  });
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
