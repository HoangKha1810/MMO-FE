import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

export type VibeCodeProvider = 'cursor' | 'codex';

export type VibeCodePackageRow = {
  id: number;
  provider: VibeCodeProvider;
  package_key: string;
  title: string;
  description: string | null;
  unit_label: string | null;
  unit_amount: number;
  source_price_vnd: number;
  sale_price_vnd: number;
  display_order: number;
  status: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type PublicVibeCodePackage = Omit<VibeCodePackageRow, 'source_price_vnd'>;

type DefaultVibeCodePackage = {
  provider: VibeCodeProvider;
  packageKey: string;
  title: string;
  description: string;
  unitLabel: string;
  unitAmount: number;
  sourcePriceVnd: number;
  salePriceVnd: number;
  displayOrder: number;
};

const cursorPackages: DefaultVibeCodePackage[] = ([
  ['700 request', 700, 75_000, 100_000],
  ['1300 request', 1300, 100_000, 150_000],
  ['2600 request', 2600, 150_000, 210_000],
  ['6500 request', 6500, 200_000, 280_000],
  ['13000 request', 13_000, 300_000, 400_000],
] satisfies Array<[string, number, number, number]>).map(([label, amount, sourcePrice, salePrice], index) => ({
  provider: 'cursor' as const,
  packageKey: `cursor_${amount}_requests`,
  title: `Cursor AI ${label}`,
  description: 'Gói request Cursor AI. Sau khi mua, gửi mã đơn cho admin để được hướng dẫn kích hoạt.',
  unitLabel: 'request',
  unitAmount: amount,
  sourcePriceVnd: sourcePrice,
  salePriceVnd: salePrice,
  displayOrder: (index + 1) * 10,
}));

const cursorProPackages: DefaultVibeCodePackage[] = ([
  ['1 Day Pro', 1, 25_000, 30_000],
  ['3 Day Pro', 3, 50_000, 60_000],
  ['7 Day Pro', 7, 75_000, 100_000],
  ['30 Day Pro', 30, 200_000, 280_000],
] satisfies Array<[string, number, number, number]>).map(([label, amount, sourcePrice, salePrice], index) => ({
  provider: 'cursor' as const,
  packageKey: `cursor_${amount}_day_pro`,
  title: `Cursor AI ${label}`,
  description: 'Gói Cursor Pro theo ngày. Sau khi mua, gửi mã đơn cho admin để được hướng dẫn kích hoạt.',
  unitLabel: 'ngày Pro',
  unitAmount: amount,
  sourcePriceVnd: sourcePrice,
  salePriceVnd: salePrice,
  displayOrder: 70 + (index + 1) * 10,
}));

const codexPackages: DefaultVibeCodePackage[] = [10, 50, 100, 200, 400].map((usd, index) => {
  const sourcePriceVnd = usd * 500;
  return {
    provider: 'codex' as const,
    packageKey: `codex_api_${usd}_usd`,
    title: `Codex API ${usd}$`,
    description: 'Gói credit Codex API. Sau khi mua, gửi mã đơn cho admin để được hướng dẫn cấp mã.',
    unitLabel: 'USD API',
    unitAmount: usd,
    sourcePriceVnd,
    salePriceVnd: usd * 1_000,
    displayOrder: (index + 1) * 10,
  };
});

const DEFAULT_VIBE_CODE_PACKAGES = [
  ...cursorPackages,
  ...cursorProPackages,
  ...codexPackages,
];

let ensurePromise: Promise<void> | null = null;

function normalizePackage(row: Record<string, unknown>): VibeCodePackageRow {
  return {
    id: Math.trunc(toNumber(row.id, 0)),
    provider: String(row.provider || 'cursor') === 'codex' ? 'codex' : 'cursor',
    package_key: String(row.package_key || ''),
    title: String(row.title || ''),
    description: row.description == null ? null : String(row.description),
    unit_label: row.unit_label == null ? null : String(row.unit_label),
    unit_amount: toNumber(row.unit_amount, 0),
    source_price_vnd: toNumber(row.source_price_vnd, 0),
    sale_price_vnd: toNumber(row.sale_price_vnd, 0),
    display_order: Math.trunc(toNumber(row.display_order, 0)),
    status: String(row.status || 'active'),
    created_at: row.created_at as string | Date | undefined,
    updated_at: row.updated_at as string | Date | undefined,
  };
}

function toPublicPackage(row: VibeCodePackageRow): PublicVibeCodePackage {
  const { source_price_vnd: _sourcePrice, ...publicRow } = row;
  return publicRow;
}

function generateOrderCode() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VC-${time}-${random}`;
}

export async function ensureVibeCodeTables() {
  ensurePromise ||= (async () => {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS vibe_code_packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(32) NOT NULL,
        package_key VARCHAR(80) NOT NULL,
        title VARCHAR(191) NOT NULL,
        description TEXT NULL,
        unit_label VARCHAR(80) NULL,
        unit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        source_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        sale_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        display_order INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_vibe_code_package (provider, package_key),
        INDEX idx_vibe_code_packages_provider_status (provider, status),
        INDEX idx_vibe_code_packages_order (display_order, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS vibe_code_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_code VARCHAR(64) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        package_id INT NOT NULL,
        provider VARCHAR(32) NOT NULL,
        package_key VARCHAR(80) NOT NULL,
        package_title VARCHAR(191) NOT NULL,
        unit_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        source_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        sale_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        admin_note TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vibe_code_orders_user (user_id),
        INDEX idx_vibe_code_orders_package (package_id),
        INDEX idx_vibe_code_orders_status (status),
        INDEX idx_vibe_code_orders_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    for (const item of DEFAULT_VIBE_CODE_PACKAGES) {
      await db.$executeRawUnsafe(
        `
          INSERT INTO vibe_code_packages
            (provider, package_key, title, description, unit_label, unit_amount, source_price_vnd, sale_price_vnd, display_order, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            unit_label = VALUES(unit_label),
            unit_amount = VALUES(unit_amount),
            source_price_vnd = VALUES(source_price_vnd),
            sale_price_vnd = IF(COALESCE(sale_price_vnd, 0) <= 0, VALUES(sale_price_vnd), sale_price_vnd),
            display_order = VALUES(display_order),
            status = IF(COALESCE(status, '') = '', 'active', status)
        `,
        item.provider,
        item.packageKey,
        item.title,
        item.description,
        item.unitLabel,
        item.unitAmount,
        item.sourcePriceVnd,
        item.salePriceVnd,
        item.displayOrder
      );
    }
  })();

  return ensurePromise;
}

export async function listVibeCodePackages(options: { activeOnly?: boolean; publicOnly?: boolean } = {}) {
  await ensureVibeCodeTables();
  const statusSql = options.activeOnly ? "WHERE status = 'active'" : '';
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT *
      FROM vibe_code_packages
      ${statusSql}
      ORDER BY provider ASC, display_order ASC, id ASC
    `
  );
  const normalized = rows.map(normalizePackage);
  return options.publicOnly ? normalized.map(toPublicPackage) : normalized;
}

export async function listUserVibeCodeOrders(userId: number) {
  await ensureVibeCodeTables();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT id, order_code, package_id, provider, package_key, package_title,
             unit_amount, sale_price_vnd, status, admin_note, created_at, updated_at
      FROM vibe_code_orders
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `,
    userId
  );

  return rows.map((row) => ({
    ...row,
    id: Math.trunc(toNumber(row.id, 0)),
    package_id: Math.trunc(toNumber(row.package_id, 0)),
    unit_amount: toNumber(row.unit_amount, 0),
    sale_price_vnd: toNumber(row.sale_price_vnd, 0),
  }));
}

export async function createVibeCodeOrder(userId: number, packageId: number) {
  await ensureVibeCodeTables();

  return db.$transaction(async (tx) => {
    const packageRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT *
        FROM vibe_code_packages
        WHERE id = ? AND status = 'active'
        LIMIT 1
        FOR UPDATE
      `,
      packageId
    );
    const selectedPackage = packageRows[0] ? normalizePackage(packageRows[0]) : null;
    if (!selectedPackage) {
      throw new Error('Gói Vibe Code không tồn tại hoặc đang tắt');
    }

    const price = Math.max(0, Math.round(selectedPackage.sale_price_vnd));
    if (price <= 0) {
      throw new Error('Gói Vibe Code chưa có giá bán hợp lệ');
    }

    const updated = await tx.$executeRawUnsafe(
      `
        UPDATE users
        SET balance = balance - ?, last_activity = NOW()
        WHERE id = ? AND balance >= ?
      `,
      price,
      userId,
      price
    );
    if (updated < 1) {
      throw new Error('Số dư ví chính không đủ để mua gói này');
    }

    const balanceRows = await tx.$queryRawUnsafe<Array<{ balance: Prisma.Decimal | number | string }>>(
      'SELECT balance FROM users WHERE id = ? LIMIT 1',
      userId
    );
    const balanceAfter = toNumber(balanceRows[0]?.balance, 0);
    const orderCode = generateOrderCode();

    await tx.$executeRawUnsafe(
      `
        INSERT INTO vibe_code_orders
          (order_code, user_id, package_id, provider, package_key, package_title, unit_amount, source_price_vnd, sale_price_vnd, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      orderCode,
      userId,
      selectedPackage.id,
      selectedPackage.provider,
      selectedPackage.package_key,
      selectedPackage.title,
      selectedPackage.unit_amount,
      selectedPackage.source_price_vnd,
      price
    );

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: price,
        balance_after: balanceAfter,
        wallet_type: 'main',
        type: 'order',
        status: 'success',
        content: `Mua ${selectedPackage.title} - mã ${orderCode}`,
      },
    }).catch(() => undefined);

    const orderRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT id, order_code, user_id, package_id, provider, package_key, package_title,
               unit_amount, sale_price_vnd, status, admin_note, created_at, updated_at
        FROM vibe_code_orders
        WHERE order_code = ?
        LIMIT 1
      `,
      orderCode
    );

    return {
      order: orderRows[0] || {
        order_code: orderCode,
        package_title: selectedPackage.title,
        provider: selectedPackage.provider,
        sale_price_vnd: price,
        status: 'pending',
      },
      balance_after: balanceAfter,
    };
  });
}
