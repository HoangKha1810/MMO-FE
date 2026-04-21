import 'server-only';

import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { buyMmoProviderProduct, getMmoProviderProductDetail } from '@/lib/mmo-provider';
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
      console.warn('[resource-actions] query failed', error);
    }
    return [];
  }
}

async function safeOne<T extends Row>(query: string, ...values: unknown[]) {
  const rows = await safeRows<T>(query, ...values);
  return rows[0] || null;
}

export async function listResourceReviews(resourceId: number) {
  const rows = await safeRows<Row>(
    `
      SELECT
        r.id,
        r.resource_id,
        r.user_id,
        r.rating,
        r.comment,
        r.created_at,
        u.username,
        u.fullname,
        u.avatar,
        u.rank
      FROM resource_reviews r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.resource_id = ?
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 50
    `,
    resourceId
  );

  return rows.map((row) => ({
    ...row,
    avatar: buildLegacyAssetUrl(String(row.avatar || '')) || '',
  }));
}

export async function purchaseResource(userId: number, resourceId: number, quantity: number) {
  const normalizedQuantity = Math.max(1, Math.min(10, Math.trunc(quantity || 1)));

  const resourceRows = await db.$queryRawUnsafe<Array<Row>>(
    `
      SELECT *
      FROM mmo_resources
      WHERE id = ?
        AND status IN ('active', 'out_of_stock')
        AND COALESCE(is_deleted, 0) = 0
      LIMIT 1
    `,
    resourceId
  );
  const resource = normalize(resourceRows[0] || {});
  if (!resource.id) {
    throw new Error('Không tìm thấy tài nguyên');
  }

  const stock = toNumber(resource.stock, 0);
  const apiProviderId = Math.max(0, Math.trunc(toNumber(resource.api_provider_id, 0)));
  const apiProductId = String(resource.api_product_id || '').trim();
  const isAuto = Boolean((resource.is_auto === true || toNumber(resource.is_auto, 0) === 1) && apiProviderId > 0 && apiProductId);

  if (stock > 0 && stock < normalizedQuantity) {
    throw new Error('Kho tài nguyên không đủ');
  }

  if (isAuto) {
    const providerDetail = await getMmoProviderProductDetail(apiProviderId, apiProductId);
    const providerStock = Math.max(0, Math.trunc(toNumber(providerDetail.product.amount, 0)));
    if (providerStock > 0 && providerStock < normalizedQuantity) {
      throw new Error('Kho CloneTut không đủ cho sản phẩm này');
    }
  }

  const pendingResult = await db.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: userId },
      select: { balance: true, username: true },
    });

    if (!user) {
      throw new Error('Không tìm thấy người dùng');
    }

    const totalPrice = toNumber(resource.price, 0) * normalizedQuantity;
    const nextBalance = toNumber(user.balance, 0) - totalPrice;
    if (nextBalance < 0) {
      throw new Error('Số dư không đủ để mua tài nguyên');
    }

    await tx.users.update({
      where: { id: userId },
      data: { balance: nextBalance, last_activity: new Date() },
    });

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: totalPrice,
        balance_after: nextBalance,
        type: 'order',
        status: 'success',
        content: `Mua tài nguyên #${resourceId} x${normalizedQuantity}`,
      },
    }).catch(() => undefined);

    const initialStatus = isAuto ? 'pending' : 'completed';
    const initialDelivery = isAuto ? '' : String(resource.download_url || resource.product_content || resource.content || '');

    await tx.$executeRawUnsafe(
      `
        INSERT INTO resource_orders (user_id, resource_id, quantity, total_price, status, payment_method, download_count, max_downloads, expires_at, created_at, updated_at, delivery_data, exported_at, is_exported)
        VALUES (?, ?, ?, ?, ?, 'balance', 0, 5, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW(), ?, NULL, 0)
      `,
      userId,
      resourceId,
      normalizedQuantity,
      totalPrice,
      initialStatus,
      initialDelivery
    );

    const inserted = await tx.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
    const orderId = Number(inserted[0]?.id || 0);

    if (!isAuto) {
      await tx.$executeRawUnsafe(
        `
          UPDATE mmo_resources
          SET stock = CASE WHEN stock IS NULL THEN NULL ELSE GREATEST(stock - ?, 0) END,
              sold_count = COALESCE(sold_count, 0) + ?,
              status = CASE
                WHEN stock IS NULL THEN status
                WHEN GREATEST(stock - ?, 0) <= 0 THEN 'out_of_stock'
                ELSE 'active'
              END,
              updated_at = NOW()
          WHERE id = ?
        `,
        normalizedQuantity,
        normalizedQuantity,
        normalizedQuantity,
        resourceId
      ).catch(() => undefined);
    }

    await tx.activity_logs.create({
      data: {
        user_id: userId,
        activity: `Mua tài nguyên #${resourceId}, order #${orderId}`,
      },
    }).catch(() => undefined);

    return { orderId, totalPrice, nextBalance };
  });

  if (!isAuto) {
    return pendingResult;
  }

  try {
    const providerPurchase = await buyMmoProviderProduct({
      providerId: apiProviderId,
      productId: apiProductId,
      amount: normalizedQuantity,
    });

    const deliveryData = [
      `Provider: ${providerPurchase.providerName}`,
      `Trans ID: ${providerPurchase.orderId}`,
      '',
      ...providerPurchase.lines,
    ].join('\n');

    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE resource_orders
          SET status = 'completed',
              delivery_data = ?,
              exported_at = NOW(),
              is_exported = 1,
              updated_at = NOW()
          WHERE id = ?
        `,
        deliveryData,
        pendingResult.orderId
      );

      await tx.$executeRawUnsafe(
        `
          UPDATE mmo_resources
          SET stock = CASE WHEN stock IS NULL THEN NULL ELSE GREATEST(stock - ?, 0) END,
              sold_count = COALESCE(sold_count, 0) + ?,
              status = CASE
                WHEN stock IS NULL THEN status
                WHEN GREATEST(stock - ?, 0) <= 0 THEN 'out_of_stock'
                ELSE 'active'
              END,
              updated_at = NOW()
          WHERE id = ?
        `,
        normalizedQuantity,
        normalizedQuantity,
        normalizedQuantity,
        resourceId
      ).catch(() => undefined);
    });

    return {
      ...pendingResult,
      provider_order_id: providerPurchase.orderId,
      provider_lines: providerPurchase.lines.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider CloneTut xử lý thất bại';

    await db.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      const refundedBalance = toNumber(user?.balance, 0) + pendingResult.totalPrice;

      await tx.users.update({
        where: { id: userId },
        data: { balance: refundedBalance, last_activity: new Date() },
      });

      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: pendingResult.totalPrice,
          balance_after: refundedBalance,
          type: 'refund',
          status: 'success',
          content: `Hoàn tiền đơn tài nguyên auto #${pendingResult.orderId}`,
        },
      }).catch(() => undefined);

      await tx.$executeRawUnsafe(
        `
          UPDATE resource_orders
          SET status = 'cancelled',
              delivery_data = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        `Provider error: ${message}`,
        pendingResult.orderId
      ).catch(() => undefined);
    });

    throw new Error(message);
  }
}

export async function submitResourceReview(userId: number, resourceId: number, rating: number, comment: string) {
  const normalizedRating = Math.max(1, Math.min(5, Math.trunc(rating || 5)));
  const purchased = await safeOne<Row>(
    `
      SELECT id
      FROM resource_orders
      WHERE user_id = ?
        AND resource_id = ?
        AND status = 'completed'
      LIMIT 1
    `,
    userId,
    resourceId
  );

  if (!purchased) {
    throw new Error('Bạn cần mua tài nguyên trước khi đánh giá');
  }

  const existing = await safeOne<Row>(
    `
      SELECT id
      FROM resource_reviews
      WHERE user_id = ? AND resource_id = ?
      LIMIT 1
    `,
    userId,
    resourceId
  );

  if (existing?.id) {
    await db.$executeRawUnsafe(
      `
        UPDATE resource_reviews
        SET rating = ?, comment = ?, created_at = NOW()
        WHERE id = ?
      `,
      normalizedRating,
      comment.slice(0, 2000),
      existing.id
    );
    return { id: existing.id };
  }

  await db.$executeRawUnsafe(
    `
      INSERT INTO resource_reviews (resource_id, user_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `,
    resourceId,
    userId,
    normalizedRating,
    comment.slice(0, 2000)
  );
  const inserted = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
  return { id: Number(inserted[0]?.id || 0) };
}

export async function getDownloadableResourceOrder(userId: number, orderId: number) {
  const order = await safeOne<Row>(
    `
      SELECT
        o.*,
        r.title,
        r.download_url,
        r.product_content,
        r.content
      FROM resource_orders o
      LEFT JOIN mmo_resources r ON r.id = o.resource_id
      WHERE o.id = ?
        AND o.user_id = ?
        AND o.status = 'completed'
      LIMIT 1
    `,
    orderId,
    userId
  );

  if (!order) {
    throw new Error('Không tìm thấy đơn tài nguyên hợp lệ');
  }

  if (order.expires_at && new Date(String(order.expires_at)).getTime() < Date.now()) {
    throw new Error('Liên kết tải đã hết hạn');
  }

  const maxDownloads = toNumber(order.max_downloads, 0);
  const downloadCount = toNumber(order.download_count, 0);
  if (maxDownloads > 0 && downloadCount >= maxDownloads) {
    throw new Error('Bạn đã dùng hết lượt tải');
  }

  await db.$executeRawUnsafe(
    `
      UPDATE resource_orders
      SET download_count = COALESCE(download_count, 0) + 1, updated_at = NOW()
      WHERE id = ?
    `,
    orderId
  ).catch(() => undefined);

  const redirectUrl = String(order.download_url || '').trim();
  if (redirectUrl) {
    return {
      type: 'redirect' as const,
      url: redirectUrl,
      filename: `${String(order.title || 'resource')}.url`,
    };
  }

  const content = String(order.delivery_data || order.product_content || order.content || '').trim();
  if (!content) {
    throw new Error('Tài nguyên này chưa có dữ liệu tải');
  }

  return {
    type: 'text' as const,
    content,
    filename: `${String(order.title || 'resource')}-${orderId}.txt`,
  };
}
