import { db } from '@/lib/db';
import {
  BLUE_TICK_BADGE_SRC,
  BLUE_TICK_MONTH_DAYS,
  BLUE_TICK_PRICE_VND,
} from '@/lib/blue-tick-constants';
import { toNumber } from '@/lib/utils';

export { BLUE_TICK_BADGE_SRC, BLUE_TICK_MONTH_DAYS, BLUE_TICK_PRICE_VND };

type ColumnCheckRow = { total: number | bigint | string | null };

let blueTickSchemaReady: Promise<void> | null = null;

export class BlueTickPurchaseError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function isBlueTickEntitlementActive(isBlueTick: unknown, expiry: unknown) {
  if (!isBlueTick) {
    return false;
  }

  if (!expiry) {
    return true;
  }

  const expiryDate = expiry instanceof Date ? expiry : new Date(String(expiry));
  return Number.isFinite(expiryDate.getTime()) && expiryDate.getTime() > Date.now();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function makeOrderCode() {
  return `BT${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function ensureColumn(table: string, column: string, definition: string) {
  const rows = await db.$queryRawUnsafe<ColumnCheckRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    table,
    column
  );
  const exists = toNumber(rows[0]?.total, 0) > 0;
  if (!exists) {
    await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

export async function ensureBlueTickTables() {
  if (!blueTickSchemaReady) {
    blueTickSchemaReady = (async () => {
      await ensureColumn('users', 'is_blue_tick', 'TINYINT(1) NULL DEFAULT 0');
      await ensureColumn('users', 'blue_tick_expiry', 'DATETIME NULL');

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS blue_tick_orders (
          id INT NOT NULL AUTO_INCREMENT,
          order_code VARCHAR(40) NOT NULL,
          user_id INT NOT NULL,
          username VARCHAR(80) NULL,
          email VARCHAR(160) NULL,
          months INT NOT NULL DEFAULT 1,
          price_vnd DECIMAL(15,2) NOT NULL DEFAULT 49000,
          balance_after DECIMAL(15,2) NULL,
          start_at DATETIME NULL,
          expires_at DATETIME NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'completed',
          admin_note TEXT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_blue_tick_order_code (order_code),
          KEY idx_blue_tick_orders_user_id (user_id),
          KEY idx_blue_tick_orders_status (status),
          KEY idx_blue_tick_orders_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch((error) => {
      blueTickSchemaReady = null;
      throw error;
    });
  }

  await blueTickSchemaReady;
}

export async function getBlueTickSnapshot(userId: number) {
  await ensureBlueTickTables();

  const user = await db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      balance: true,
      is_blue_tick: true,
      blue_tick_expiry: true,
    },
  });

  if (!user) {
    throw new BlueTickPurchaseError('Không tìm thấy tài khoản.', 404);
  }

  const isActive = isBlueTickEntitlementActive(user.is_blue_tick, user.blue_tick_expiry);

  return {
    user_id: user.id,
    username: user.username,
    email: user.email,
    price_vnd: BLUE_TICK_PRICE_VND,
    duration_days: BLUE_TICK_MONTH_DAYS,
    balance: toNumber(user.balance, 0),
    is_blue_tick: isActive,
    blue_tick_expiry: user.blue_tick_expiry ? user.blue_tick_expiry.toISOString() : null,
  };
}

export async function purchaseBlueTick(userId: number) {
  await ensureBlueTickTables();

  return db.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        balance: true,
        is_blue_tick: true,
        blue_tick_expiry: true,
      },
    });

    if (!user) {
      throw new BlueTickPurchaseError('Không tìm thấy tài khoản.', 404);
    }

    const balance = toNumber(user.balance, 0);
    if (balance < BLUE_TICK_PRICE_VND) {
      throw new BlueTickPurchaseError('Số dư không đủ để mua tick xanh.', 400);
    }

    const now = new Date();
    const currentExpiry = user.blue_tick_expiry ? new Date(user.blue_tick_expiry) : null;
    const activeBase =
      isBlueTickEntitlementActive(user.is_blue_tick, currentExpiry) && currentExpiry
        ? currentExpiry
        : now;
    const expiresAt = addDays(activeBase, BLUE_TICK_MONTH_DAYS);
    const orderCode = makeOrderCode();

    const affected = await tx.$executeRawUnsafe(
      `
        UPDATE users
        SET balance = balance - ?,
            is_blue_tick = 1,
            blue_tick_expiry = ?,
            last_activity = NOW()
        WHERE id = ?
          AND balance >= ?
      `,
      BLUE_TICK_PRICE_VND,
      expiresAt,
      user.id,
      BLUE_TICK_PRICE_VND
    );

    if (toNumber(affected, 0) < 1) {
      throw new BlueTickPurchaseError('Số dư không đủ để mua tick xanh.', 400);
    }

    const updatedUser = await tx.users.findUnique({
      where: { id: user.id },
      select: { balance: true },
    });
    const balanceAfter = toNumber(updatedUser?.balance, Math.max(0, balance - BLUE_TICK_PRICE_VND));

    await tx.$executeRawUnsafe(
      `
        INSERT INTO blue_tick_orders
          (order_code, user_id, username, email, months, price_vnd, balance_after, start_at, expires_at, status, created_at, updated_at)
        VALUES
          (?, ?, ?, ?, 1, ?, ?, ?, ?, 'completed', NOW(), NOW())
      `,
      orderCode,
      user.id,
      user.username,
      user.email,
      BLUE_TICK_PRICE_VND,
      balanceAfter,
      now,
      expiresAt
    );

    await tx.transactions.create({
      data: {
        user_id: user.id,
        amount: BLUE_TICK_PRICE_VND,
        balance_after: balanceAfter,
        wallet_type: 'main',
        type: 'order',
        status: 'success',
        content: `Mua tick xanh 1 tháng - ${orderCode}`,
      },
    });

    return {
      order_code: orderCode,
      price_vnd: BLUE_TICK_PRICE_VND,
      balance_after: balanceAfter,
      expires_at: expiresAt.toISOString(),
      is_blue_tick: true,
    };
  });
}
