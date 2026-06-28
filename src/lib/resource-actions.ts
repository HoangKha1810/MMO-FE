import 'server-only';

import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { buyMmoProviderProduct } from '@/lib/mmo-provider';
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

export function usesGameWalletResource(resource: Row) {
  return ['game', 'random'].includes(String(resource.api_account_kind || '').trim().toLowerCase());
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.ceil(value)))}đ`;
}

function insufficientBalanceMessage(wallet: 'main' | 'game', missingAmount: number) {
  return wallet === 'game'
    ? `Cần nạp thêm ví game ${formatVnd(missingAmount)} để hoàn tất đơn này.`
    : `Số dư không đủ. Vui lòng nạp thêm ${formatVnd(missingAmount)} để mua tài nguyên.`;
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
      SELECT
        id,
        price,
        stock,
        sold_count,
        status,
        download_url,
        product_content,
        content,
        api_provider_id,
        api_product_id,
        api_account_kind,
        is_auto
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
  const resourceStatus = String(resource.status || '').trim().toLowerCase();
  const apiProviderId = Math.max(0, Math.trunc(toNumber(resource.api_provider_id, 0)));
  const apiProductId = String(resource.api_product_id || '').trim();
  const isAuto = Boolean((resource.is_auto === true || toNumber(resource.is_auto, 0) === 1) && apiProviderId > 0 && apiProductId);
  const wallet = usesGameWalletResource(resource) ? 'game' : 'main';
  const settings = await getLegacySettingsMap();
  const vatPercent = getVatPercent(settings);
  const subtotal = toNumber(resource.price, 0) * normalizedQuantity;
  const vatAmount = Math.round((subtotal * vatPercent) / 100);
  const totalPrice = subtotal + vatAmount;

  if (resourceStatus === 'out_of_stock' || (!isAuto && stock < normalizedQuantity) || (isAuto && stock > 0 && stock < normalizedQuantity)) {
    throw new Error('Kho tài nguyên không đủ');
  }

  const balanceSnapshot = await db.users.findUnique({
    where: { id: userId },
    select: { balance: true, game_balance: true },
  });
  if (!balanceSnapshot) {
    throw new Error('Không tìm thấy người dùng');
  }

  const availableBalance = wallet === 'game'
    ? toNumber(balanceSnapshot.game_balance, 0)
    : toNumber(balanceSnapshot.balance, 0);
  if (availableBalance < totalPrice) {
    throw new Error(insufficientBalanceMessage(wallet, totalPrice - availableBalance));
  }

  const pendingResult = await db.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: userId },
      select: { balance: true, game_balance: true },
    });

    if (!user) {
      throw new Error('Không tìm thấy người dùng');
    }

    const currentBalance = wallet === 'game' ? toNumber(user.game_balance, 0) : toNumber(user.balance, 0);
    const nextBalance = currentBalance - totalPrice;
    if (nextBalance < 0) {
      throw new Error(insufficientBalanceMessage(wallet, Math.abs(nextBalance)));
    }

    await tx.users.update({
      where: { id: userId },
      data: wallet === 'game'
        ? { game_balance: nextBalance, last_activity: new Date() }
        : { balance: nextBalance, last_activity: new Date() },
    });

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: totalPrice,
        balance_after: nextBalance,
        wallet_type: wallet,
        type: 'order',
        status: 'success',
        content: wallet === 'game'
          ? `Mua tài khoản game/random #${resourceId} x${normalizedQuantity} bằng ví game`
          : `Mua tài nguyên #${resourceId} x${normalizedQuantity}`,
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

    return { orderId, subtotal, vatAmount, totalPrice, nextBalance, wallet };
  }, { maxWait: 10000, timeout: 15000 });

  await db.activity_logs.create({
    data: {
      user_id: userId,
      activity: `Mua tài nguyên #${resourceId}, order #${pendingResult.orderId}`,
    },
  }).catch(() => undefined);

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
    const message = error instanceof Error ? error.message : 'Provider MMO xử lý thất bại';

    await db.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { balance: true, game_balance: true },
      });
      const refundedBalance = pendingResult.wallet === 'game'
        ? toNumber(user?.game_balance, 0) + pendingResult.totalPrice
        : toNumber(user?.balance, 0) + pendingResult.totalPrice;

      await tx.users.update({
        where: { id: userId },
        data: pendingResult.wallet === 'game'
          ? { game_balance: refundedBalance, last_activity: new Date() }
          : { balance: refundedBalance, last_activity: new Date() },
      });

      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: pendingResult.totalPrice,
          balance_after: refundedBalance,
          wallet_type: pendingResult.wallet,
          type: 'refund',
          status: 'success',
          content: pendingResult.wallet === 'game'
            ? `Hoàn tiền đơn tài khoản game/random auto #${pendingResult.orderId} vào ví game`
            : `Hoàn tiền đơn tài nguyên auto #${pendingResult.orderId}`,
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
