import 'server-only';

import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

export const META_SUPPORT_PACKAGES = [
  { quantity: 1, price: 450_000, label: '1 tài khoản' },
  { quantity: 10, price: 4_500_000, label: '10 tài khoản' },
  { quantity: 100, price: 45_000_000, label: '100 tài khoản' },
] as const;

export const META_SUPPORT_SERVICE_NAME = 'Auto kích nút + Chat Support Meta';

export type MetaSupportPackage = (typeof META_SUPPORT_PACKAGES)[number];

export interface MetaSupportOrder {
  id: number;
  user_id: number;
  username?: string | null;
  contact: string;
  gmail: string;
  quantity: number;
  price: number;
  note: string | null;
  admin_note: string | null;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

let metaSupportTableReady = false;

export async function ensureMetaSupportOrdersTable() {
  if (metaSupportTableReady) return;

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS meta_support_orders (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      contact VARCHAR(255) NOT NULL,
      gmail TEXT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      price DECIMAL(15,2) NOT NULL DEFAULT 0,
      note TEXT NULL,
      admin_note TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_meta_support_user_status (user_id, status),
      KEY idx_meta_support_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  metaSupportTableReady = true;
}

export function resolveMetaSupportPackage(quantity: unknown): MetaSupportPackage | null {
  const value = Math.trunc(toNumber(quantity, 0));
  return META_SUPPORT_PACKAGES.find((item) => item.quantity === value) || null;
}

export function normalizeMetaSupportStatus(status: unknown) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['processing', 'in_progress', 'running', 'dang xu ly'].includes(normalized)) return 'processing';
  if (['completed', 'complete', 'success', 'done', 'hoan tat'].includes(normalized)) return 'completed';
  if (['canceled', 'cancelled', 'cancel', 'failed', 'reject', 'rejected', 'da huy'].includes(normalized)) return 'canceled';
  return 'pending';
}

function normalizeOrder(row: MetaSupportOrder): MetaSupportOrder {
  return {
    ...row,
    quantity: Math.trunc(toNumber(row.quantity, 0)),
    price: toNumber(row.price, 0),
    status: normalizeMetaSupportStatus(row.status),
  };
}

export async function listMetaSupportOrders(userId: number) {
  await ensureMetaSupportOrdersTable();

  const rows = await db.$queryRawUnsafe<MetaSupportOrder[]>(
    `
      SELECT id, user_id, contact, gmail, quantity, price, note, admin_note, status, created_at, updated_at
      FROM meta_support_orders
      WHERE user_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 100
    `,
    userId
  );

  return rows.map(normalizeOrder);
}

export async function createMetaSupportOrder(input: {
  userId: number;
  quantity: unknown;
  contact: unknown;
  gmail: unknown;
  note?: unknown;
}) {
  await ensureMetaSupportOrdersTable();

  const selectedPackage = resolveMetaSupportPackage(input.quantity);
  if (!selectedPackage) {
    throw new Error('Gói dịch vụ không hợp lệ');
  }

  const contact = String(input.contact || '').trim();
  const gmail = String(input.gmail || '').trim();
  const note = String(input.note || '').trim();

  if (!contact) {
    throw new Error('Vui lòng nhập thông tin liên hệ');
  }

  if (!gmail) {
    throw new Error('Vui lòng nhập Gmail cần xử lý');
  }

  return db.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: input.userId },
      select: { id: true, balance: true },
    });
    if (!user) {
      throw new Error('Không tìm thấy tài khoản');
    }

    const currentBalance = toNumber(user.balance, 0);
    const nextBalance = currentBalance - selectedPackage.price;
    if (nextBalance < 0) {
      throw new Error('Số dư ví chính không đủ để tạo đơn');
    }

    await tx.users.update({
      where: { id: input.userId },
      data: { balance: nextBalance, last_activity: new Date() },
    });

    await tx.$executeRawUnsafe(
      `
        INSERT INTO meta_support_orders
          (user_id, contact, gmail, quantity, price, note, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
      `,
      input.userId,
      contact,
      gmail,
      selectedPackage.quantity,
      selectedPackage.price,
      note || null
    );
    const orderIdRows = await tx.$queryRawUnsafe<Array<{ id: number }>>('SELECT LAST_INSERT_ID() AS id');
    const orderId = Number(orderIdRows[0]?.id || 0);

    await tx.transactions.create({
      data: {
        user_id: input.userId,
        amount: selectedPackage.price,
        balance_after: nextBalance,
        wallet_type: 'main',
        type: 'order',
        status: 'success',
        content: `Tạo đơn ${META_SUPPORT_SERVICE_NAME} ${selectedPackage.label}`,
      },
    }).catch(() => undefined);

    const rows = await tx.$queryRawUnsafe<MetaSupportOrder[]>(
      `
        SELECT id, user_id, contact, gmail, quantity, price, note, admin_note, status, created_at, updated_at
        FROM meta_support_orders
        WHERE id = ?
        LIMIT 1
      `,
      orderId
    );

    return {
      order: rows[0] ? normalizeOrder(rows[0]) : null,
      balance_after: nextBalance,
      package: selectedPackage,
    };
  });
}
