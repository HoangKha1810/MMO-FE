import { db } from '@/lib/db';
import { getVietnamDatabaseDateTime } from '@/lib/date-time';
import { toNumber } from '@/lib/utils';

export type WebServiceCategory = 'web_con' | 'build_web';

export type WebServicePackageRow = {
  id: number;
  category: WebServiceCategory;
  package_key: string;
  title: string;
  description: string | null;
  price_min_vnd: number;
  price_max_vnd: number;
  display_order: number;
  status: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type WebServiceOrderRow = {
  id: number;
  order_code: string;
  user_id: number;
  package_id: number;
  category: WebServiceCategory;
  package_key: string;
  package_title: string;
  price_min_vnd: number;
  price_max_vnd: number;
  quoted_price_vnd: number;
  contact: string | null;
  desired_domain: string | null;
  requirement: string | null;
  status: string;
  admin_note: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
};

type DefaultWebServicePackage = {
  category: WebServiceCategory;
  packageKey: string;
  title: string;
  description: string;
  priceMinVnd: number;
  priceMaxVnd: number;
  displayOrder: number;
};

const DEFAULT_WEB_SERVICE_PACKAGES: DefaultWebServicePackage[] = [
  {
    category: 'web_con',
    packageKey: 'web_con_one_service',
    title: 'Đấu 1 dịch vụ',
    description: 'Web con MMO và đấu nối 1 dịch vụ theo nhu cầu vận hành.',
    priceMinVnd: 2_000_000,
    priceMaxVnd: 2_000_000,
    displayOrder: 10,
  },
  {
    category: 'web_con',
    packageKey: 'web_con_full_service',
    title: 'Đấu full dịch vụ',
    description: 'Web con MMO và đấu nối full dịch vụ theo hệ thống của shop.',
    priceMinVnd: 15_000_000,
    priceMaxVnd: 15_000_000,
    displayOrder: 20,
  },
  {
    category: 'build_web',
    packageKey: 'portfolio',
    title: 'Portfolio',
    description: 'Website portfolio cá nhân, giới thiệu năng lực, dự án và hồ sơ làm việc.',
    priceMinVnd: 2_000_000,
    priceMaxVnd: 3_000_000,
    displayOrder: 110,
  },
  {
    category: 'build_web',
    packageKey: 'personal_info',
    title: 'Web thông tin cá nhân',
    description: 'Trang thông tin cá nhân, số tài khoản cá nhân, liên hệ và hồ sơ cơ bản.',
    priceMinVnd: 500_000,
    priceMaxVnd: 1_000_000,
    displayOrder: 120,
  },
  {
    category: 'build_web',
    packageKey: 'online_store',
    title: 'Web bán hàng online / cafe store',
    description: 'Full dịch vụ thanh toán online, đặt đơn, quản lý sản phẩm và đơn hàng.',
    priceMinVnd: 5_000_000,
    priceMaxVnd: 10_000_000,
    displayOrder: 130,
  },
  {
    category: 'build_web',
    packageKey: 'chatbot',
    title: 'Web Chatbot',
    description: 'Call API model hoặc build model tùy chỉnh theo workflow riêng.',
    priceMinVnd: 10_000_000,
    priceMaxVnd: 15_000_000,
    displayOrder: 140,
  },
  {
    category: 'build_web',
    packageKey: 'custom',
    title: 'Web khác',
    description: 'Dự án web riêng, admin tư vấn và báo giá theo yêu cầu thực tế.',
    priceMinVnd: 0,
    priceMaxVnd: 0,
    displayOrder: 150,
  },
];

let ensurePromise: Promise<void> | null = null;

function normalizeCategory(value: unknown): WebServiceCategory {
  return String(value || '') === 'build_web' ? 'build_web' : 'web_con';
}

function normalizePackage(row: Record<string, unknown>): WebServicePackageRow {
  return {
    id: Math.trunc(toNumber(row.id, 0)),
    category: normalizeCategory(row.category),
    package_key: String(row.package_key || ''),
    title: String(row.title || ''),
    description: row.description == null ? null : String(row.description),
    price_min_vnd: toNumber(row.price_min_vnd, 0),
    price_max_vnd: toNumber(row.price_max_vnd, 0),
    display_order: Math.trunc(toNumber(row.display_order, 0)),
    status: String(row.status || 'active'),
    created_at: row.created_at as string | Date | undefined,
    updated_at: row.updated_at as string | Date | undefined,
  };
}

function normalizeOrder(row: Record<string, unknown>): WebServiceOrderRow {
  return {
    id: Math.trunc(toNumber(row.id, 0)),
    order_code: String(row.order_code || ''),
    user_id: Math.trunc(toNumber(row.user_id, 0)),
    package_id: Math.trunc(toNumber(row.package_id, 0)),
    category: normalizeCategory(row.category),
    package_key: String(row.package_key || ''),
    package_title: String(row.package_title || ''),
    price_min_vnd: toNumber(row.price_min_vnd, 0),
    price_max_vnd: toNumber(row.price_max_vnd, 0),
    quoted_price_vnd: toNumber(row.quoted_price_vnd, 0),
    contact: row.contact == null ? null : String(row.contact),
    desired_domain: row.desired_domain == null ? null : String(row.desired_domain),
    requirement: row.requirement == null ? null : String(row.requirement),
    status: String(row.status || 'pending'),
    admin_note: row.admin_note == null ? null : String(row.admin_note),
    created_at: row.created_at as string | Date | undefined,
    updated_at: row.updated_at as string | Date | undefined,
  };
}

function generateOrderCode() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WEB-${time}-${random}`;
}

export async function ensureWebServiceTables() {
  ensurePromise ||= (async () => {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS web_service_packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(32) NOT NULL,
        package_key VARCHAR(80) NOT NULL,
        title VARCHAR(191) NOT NULL,
        description TEXT NULL,
        price_min_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        price_max_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        display_order INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_web_service_package (category, package_key),
        INDEX idx_web_service_packages_category_status (category, status),
        INDEX idx_web_service_packages_order (display_order, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS web_service_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_code VARCHAR(64) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        package_id INT NOT NULL,
        category VARCHAR(32) NOT NULL,
        package_key VARCHAR(80) NOT NULL,
        package_title VARCHAR(191) NOT NULL,
        price_min_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        price_max_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        quoted_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        contact VARCHAR(191) NULL,
        desired_domain VARCHAR(191) NULL,
        requirement TEXT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        admin_note TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_web_service_orders_user (user_id),
        INDEX idx_web_service_orders_package (package_id),
        INDEX idx_web_service_orders_status (status),
        INDEX idx_web_service_orders_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    for (const item of DEFAULT_WEB_SERVICE_PACKAGES) {
      await db.$executeRawUnsafe(
        `
          INSERT INTO web_service_packages
            (category, package_key, title, description, price_min_vnd, price_max_vnd, display_order, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            price_min_vnd = IF(COALESCE(price_min_vnd, 0) <= 0, VALUES(price_min_vnd), price_min_vnd),
            price_max_vnd = IF(COALESCE(price_max_vnd, 0) <= 0, VALUES(price_max_vnd), price_max_vnd),
            display_order = VALUES(display_order),
            status = IF(COALESCE(status, '') = '', 'active', status)
        `,
        item.category,
        item.packageKey,
        item.title,
        item.description,
        item.priceMinVnd,
        item.priceMaxVnd,
        item.displayOrder
      );
    }
  })();

  return ensurePromise;
}

export async function listWebServicePackages(options: { activeOnly?: boolean } = {}) {
  await ensureWebServiceTables();
  const statusSql = options.activeOnly ? "WHERE status = 'active'" : '';
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT *
      FROM web_service_packages
      ${statusSql}
      ORDER BY FIELD(category, 'web_con', 'build_web'), display_order ASC, id ASC
    `
  );

  return rows.map(normalizePackage);
}

export async function listUserWebServiceOrders(userId: number) {
  await ensureWebServiceTables();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT *
      FROM web_service_orders
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 50
    `,
    userId
  );

  return rows.map(normalizeOrder);
}

export async function createWebServiceOrder(
  userId: number,
  input: {
    packageId: number;
    contact?: string;
    desiredDomain?: string;
    requirement?: string;
  }
) {
  await ensureWebServiceTables();

  const packageId = Math.trunc(toNumber(input.packageId, 0));
  if (!packageId) {
    throw new Error('Thiếu gói dịch vụ cần đặt');
  }

  const contact = String(input.contact || '').trim().slice(0, 191);
  const desiredDomain = String(input.desiredDomain || '').trim().slice(0, 191);
  const requirement = String(input.requirement || '').trim();

  if (contact.length < 3) {
    throw new Error('Vui lòng nhập thông tin liên hệ để admin trao đổi');
  }

  if (requirement.length < 10) {
    throw new Error('Vui lòng mô tả nhu cầu tối thiểu 10 ký tự');
  }

  return db.$transaction(async (tx) => {
    const packageRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT *
        FROM web_service_packages
        WHERE id = ? AND status = 'active'
        LIMIT 1
      `,
      packageId
    );
    const selectedPackage = packageRows[0] ? normalizePackage(packageRows[0]) : null;
    if (!selectedPackage) {
      throw new Error('Gói dịch vụ không tồn tại hoặc đang tắt');
    }

    const now = getVietnamDatabaseDateTime();
    const orderCode = generateOrderCode();
    await tx.$executeRawUnsafe(
      `
        INSERT INTO web_service_orders
          (order_code, user_id, package_id, category, package_key, package_title,
           price_min_vnd, price_max_vnd, contact, desired_domain, requirement, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `,
      orderCode,
      userId,
      selectedPackage.id,
      selectedPackage.category,
      selectedPackage.package_key,
      selectedPackage.title,
      selectedPackage.price_min_vnd,
      selectedPackage.price_max_vnd,
      contact,
      desiredDomain || null,
      requirement,
      now,
      now
    );

    const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT *
        FROM web_service_orders
        WHERE order_code = ?
        LIMIT 1
      `,
      orderCode
    );

    return normalizeOrder(rows[0] || {
      order_code: orderCode,
      user_id: userId,
      package_id: selectedPackage.id,
      category: selectedPackage.category,
      package_key: selectedPackage.package_key,
      package_title: selectedPackage.title,
      price_min_vnd: selectedPackage.price_min_vnd,
      price_max_vnd: selectedPackage.price_max_vnd,
      quoted_price_vnd: 0,
      contact,
      desired_domain: desiredDomain || null,
      requirement,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
  });
}
