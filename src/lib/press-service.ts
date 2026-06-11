import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getUtcDatabaseDateTime } from '@/lib/date-time';
import { toNumber } from '@/lib/utils';

export type PressPublicationRow = {
  id: number;
  publication_key: string;
  name: string;
  url: string | null;
  price_vnd: number;
  note: string | null;
  display_order: number;
  status: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type PressOrderRow = {
  id: number;
  order_code: string;
  user_id: number;
  publication_id: number;
  publication_name: string;
  title: string | null;
  contact: string | null;
  note: string | null;
  docx_path: string;
  price_vnd: number;
  status: string;
  admin_note: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
};

type DefaultPressPublication = {
  key: string;
  name: string;
  url: string;
  price: number;
  note: string;
  order: number;
};

const basePressPublications: DefaultPressPublication[] = [
  { key: 'dantri', name: 'Dân Trí', url: 'https://dantri.com.vn', price: 17_340_000, note: 'Nhóm 1. Xã hội, Kinh doanh, Thế giới...', order: 10 },
  { key: 'soha', name: 'Soha', url: 'https://soha.vn', price: 7_480_000, note: 'Nhóm 2. Lao động - Việc làm, Giáo dục...', order: 20 },
  { key: 'tuoitre', name: 'Tuổi Trẻ', url: 'https://tuoitre.vn', price: 8_925_000, note: 'Vị trí top 5 trang chủ và chuyên mục.', order: 30 },
  { key: 'thanhnien', name: 'Thanh Niên', url: 'https://thanhnien.vn', price: 20_910_000, note: 'Trang chủ, vị trí top 5 tin mới.', order: 40 },
  { key: 'tienphong', name: 'Tiền Phong', url: 'https://www.tienphong.vn', price: 7_650_000, note: 'Mục phù hợp, 800 từ, 3 ảnh, 1 link cuối.', order: 50 },
  { key: 'vtcnews', name: 'VTC News', url: 'https://vtcnews.vn', price: 5_525_000, note: 'Mục phù hợp thường bài.', order: 60 },
  { key: '24h', name: '24h', url: 'https://www.24h.com.vn', price: 7_344_000, note: '1000 từ, 5 ảnh, 3 link nofollow với DN.', order: 70 },
  { key: 'vietnamnet', name: 'Vietnamnet', url: 'https://vietnamnet.vn', price: 8_364_000, note: 'Mục doanh nghiệp, 600 từ, 3 ảnh, free link.', order: 80 },
  { key: 'nhipcaudautu', name: 'Nhịp Cầu Đầu Tư', url: 'https://nhipcaudautu.vn', price: 11_900_000, note: '500 từ, 1 ảnh, 1 link.', order: 90 },
  { key: 'nguoiduatin', name: 'Người Đưa Tin', url: 'https://www.nguoiduatin.vn', price: 8_160_000, note: 'Tin mục phù hợp, 1000 từ, 5 ảnh.', order: 100 },
  { key: 'laodong', name: 'Lao Động', url: 'https://laodong.vn', price: 6_800_000, note: 'Mục doanh nghiệp, 800 từ, 2 ảnh.', order: 110 },
  { key: 'vov', name: 'VOV', url: 'https://vov.vn', price: 18_360_000, note: 'Chuyên mục phù hợp, 1000 từ, 3 ảnh.', order: 120 },
  { key: 'vnexpress', name: 'VnExpress', url: 'https://vnexpress.net', price: 10_200_000, note: 'Nhiều gói: tiêu mục du lịch, sức khoẻ...', order: 130 },
  { key: 'vtv', name: 'VTV', url: 'https://vtv.vn', price: 8_670_000, note: 'Mục phù hợp, 1000 từ, 5 ảnh, có free link.', order: 140 },
  { key: 'cafebiz', name: 'CafeBiz', url: 'https://cafebiz.vn', price: 7_310_000, note: 'Mục phù hợp, 1000 từ, 5 ảnh, free link.', order: 150 },
  { key: 'cafef', name: 'CafeF', url: 'https://cafef.vn', price: 8_976_000, note: 'Thông cáo báo chí, 1000 từ, 5 ảnh, free link.', order: 160 },
  { key: 'vietnammoi', name: 'Việt Nam Mới', url: 'https://vietnammoi.vn', price: 3_621_000, note: 'Mục phù hợp, 1000 từ, 5 ảnh, không free link.', order: 170 },
  { key: 'suckhoedoisong', name: 'Sức Khoẻ Đời Sống', url: 'https://suckhoedoisong.vn', price: 6_630_000, note: 'Mục phù hợp, 1200 từ, 3 ảnh, free 1 link.', order: 180 },
  { key: 'vietnambiz', name: 'Việt Nam Biz', url: 'https://vietnambiz.vn', price: 3_621_000, note: 'Mục phù hợp, 1000 từ, 5 ảnh.', order: 190 },
  { key: 'techz', name: 'TechZ', url: 'https://www.techz.vn', price: 2_805_000, note: 'Mục phù hợp, 1000 từ, 2 ảnh, free link.', order: 200 },
  { key: 'giadinhonline', name: 'Gia Đình Online', url: 'https://giadinhonline.vn', price: 3_570_000, note: '1000 từ, 5 ảnh, không free link.', order: 210 },
  { key: 'saostar', name: 'SaoStar', url: 'https://www.saostar.vn', price: 2_975_000, note: 'Mục phù hợp, 1000 từ, 2 ảnh, free link.', order: 220 },
  { key: 'eva', name: 'Eva', url: 'https://eva.vn', price: 6_375_000, note: 'Mục phù hợp, 1000 từ, 5 ảnh, 1 link.', order: 230 },
  { key: 'yan', name: 'YAN', url: 'https://www.yan.vn', price: 3_315_000, note: 'Mục phù hợp, 1000 từ, 5 ảnh, có gắn link.', order: 240 },
  { key: 'yeah1', name: 'Yeah1', url: 'https://yeah1.com', price: 5_270_000, note: 'Mục phù hợp, 1000 từ, 5 ảnh, free 2 link.', order: 250 },
  { key: 'vietstock', name: 'Vietstock', url: 'https://vietstock.vn', price: 2_890_000, note: 'Mục cân bằng, 1000 từ, 3 ảnh, 2 link dofollow.', order: 260 },
  { key: 'cafedautu', name: 'Cafe Đầu Tư', url: 'https://cafedautu.vn', price: 1_700_000, note: 'Mục phù hợp, 1000 từ, 5 ảnh, free 2 link.', order: 270 },
  { key: 'emdep', name: 'Em Đẹp', url: 'https://emdep.vn', price: 2_040_000, note: 'Mục phù hợp, 1000 từ, 3 ảnh, 2 link.', order: 280 },
];

const press450kSources = [
  ['nongthonvaphattrien', 'Nông Thôn Và Phát Triển', 'https://nongthonvaphattrien.vn/'],
  ['kinhtevadautu', 'Kinh Tế Và Đầu Tư', 'https://kinhtevadautu.info/'],
  ['doisongvaphattrien', 'Đời Sống Và Phát Triển', 'https://doisongvaphattrien.vn/'],
  ['vanhoadoisong', 'Văn Hoá Đời Sống', 'https://vanhoadoisong.net/'],
  ['khoahoccuocsong', 'Khoa Học Cuộc Sống', 'https://khoahoccuocsong.com/'],
  ['wikimedia-vn', 'Wikimedia Việt Nam', 'https://wikimedia.net.vn/'],
  ['suckhoevacongdong', 'Sức Khoẻ Và Cộng Đồng', 'https://suckhoevacongdong.com/'],
  ['propr', 'Propr', 'https://propr.vn/'],
  ['vietnamhuongsac', 'Việt Nam Hương Sắc', 'https://vietnamhuongsac.vn/'],
  ['phano', 'Phano', 'https://phano.info/'],
  ['tinhhoathoidai', 'Tinh Hoa Thời Đại', 'https://tinhhoathoidai.vn/'],
  ['vanhoathoidai', 'Văn Hoá Thời Đại', 'https://vanhoathoidai.vn/'],
  ['thegioinguoidep', 'Thế Giới Người Đẹp', 'https://thegioinguoidep.info/'],
  ['ketnoithuonghieu', 'Kết Nối Thương Hiệu', 'https://ketnoithuonghieu.info/'],
  ['saoviet', 'Sao Việt', 'https://saoviet.biz/'],
  ['thuonghieudoanhnhan', 'Thương Hiệu Doanh Nhân', 'https://thuonghieudoanhnhan.net'],
  ['suckhoevasacdep', 'Sức Khoẻ Và Sắc Đẹp', 'https://suckhoevasacdep.com.vn'],
  ['dantriviet', 'Dân Trí Việt', 'https://dantriviet.info/'],
  ['kenhkinhte', 'Kênh Kinh Tế', 'https://kenhkinhte.vn/'],
  ['giaoduccuocsong', 'Giáo Dục Cuộc Sống', 'https://giaoduccuocsong.vn'],
  ['amnhaccuocsong', 'Âm Nhạc Cuộc Sống', 'https://amnhaccuocsong.net/'],
  ['sukien24h', 'Sự Kiện 24h', 'https://sukien24h.net/'],
  ['phapluatkinhdoanh', 'Pháp Luật Kinh Doanh', 'https://phapluatkinhdoanh.com/'],
  ['phapluatcuocsong', 'Pháp Luật Cuộc Sống', 'https://phapluatcuocsong.com/'],
  ['vanhienviet', 'Văn Hiến Việt', 'https://vanhienviet.com.vn/'],
  ['vietnambest', 'Vietnam Best', 'https://vietnambest.net/'],
  ['phapluatvathoidai', 'Pháp Luật Và Thời Đại', 'https://phapluatvathoidai.net/'],
  ['thuonghieuvacuocsong', 'Thương Hiệu Và Cuộc Sống', 'https://thuonghieuvacuocsong.info/'],
  ['nhiepanhvacuocsong', 'Nhiếp Ảnh Và Cuộc Sống', 'https://nhiepanhvacuocsong.net/'],
  ['vanhien', 'Văn Hiến', 'https://vanhien.info/'],
  ['tapchiamnhac', 'Tạp Chí Âm Nhạc', 'https://tapchiamnhac.vn/'],
  ['thuonghieusacdep', 'Thương Hiệu Sắc Đẹp', 'https://thuonghieusacdep.vn/'],
  ['propr-www', 'Propr', 'https://www.propr.vn/'],
  ['vanhoaviet', 'Văn Hoá Việt', 'https://vanhoaviet.asia'],
  ['sige-edu', 'SIGE EDU', 'https://sige.edu.vn/'],
  ['vanhoaphattrien', 'Văn Hoá Phát Triển', 'https://vanhoaphattrien.vn/'],
  ['vanhoathuonghieu', 'Văn Hoá Thương Hiệu', 'https://vanhoathuonghieu.vn'],
] as const satisfies ReadonlyArray<readonly [string, string, string]>;

const press250kSources = [
  ['nhipsonghiendai', 'Nhịp Sống Hiện Đại', 'https://nhipsonghiendai.com'],
  ['giadinhvasuckhoe', 'Gia Đình Và Sức Khoẻ', 'https://giadinhvasuckhoe.com'],
  ['tintucdoday', 'Tin Tức Đó Đây', 'https://tintucdoday.com/quantri'],
  ['ngoisaovavanhoa', 'Ngôi Sao Và Văn Hoá', 'https://ngoisaovavanhoa.com/'],
  ['vanhoaonline', 'Văn Hoá Online', 'https://vanhoaonline.net'],
  ['doanhnhanvathitruong', 'Doanh Nhân Và Thị Trường', 'https://doanhnhanvathitruong.com'],
  ['doisongvaxahoi', 'Đời Sống Và Xã Hội', 'https://doisongvaxahoi.net'],
  ['nhipcaukinhdoanh', 'Nhịp Cầu Kinh Doanh', 'https://nhipcaukinhdoanh.com'],
  ['kinhtevathoidai', 'Kinh Tế Và Thời Đại', 'https://kinhtevathoidai.com'],
  ['ketnoicuocsong', 'Kết Nối Cuộc Sống', 'https://ketnoicuocsong.com'],
  ['taichinhkinhdoanhso', 'Tài Chính Kinh Doanh Số', 'https://taichinhkinhdoanhso.com'],
  ['thitruongngaynay', 'Thị Trường Ngày Nay', 'https://thitruongngaynay.com'],
  ['suckhoengaynay', 'Sức Khoẻ Ngày Nay', 'https://suckhoengaynay.net'],
  ['doanhnhanvathoidai', 'Doanh Nhân Và Thời Đại', 'https://doanhnhanvathoidai.com'],
  ['hoinhapdautu', 'Hội Nhập Đầu Tư', 'https://hoinhapdautu.com'],
  ['kinhdoanhvatieudung', 'Kinh Doanh Và Tiêu Dùng', 'https://kinhdoanhvatieudung.com'],
  ['ngoisaovn', 'Ngôi Sao VN', 'https://ngoisaovn.com'],
  ['tieudungtiepthi', 'Tiêu Dùng Tiếp Thị', 'https://tieudungtiepthi.com'],
  ['doanhnghiepvathuonghieu', 'Doanh Nghiệp Và Thương Hiệu', 'https://doanhnghiepvathuonghieu.com'],
  ['gocnhindautu', 'Góc Nhìn Đầu Tư', 'https://gocnhindautu.net'],
  ['baohiemvadoanhnghiep', 'Bảo Hiểm Và Doanh Nghiệp', 'https://baohiemvadoanhnghiep.com'],
  ['taichinhvathuonghieu', 'Tài Chính Và Thương Hiệu', 'https://taichinhvathuonghieu.com'],
  ['khoahocvathoidai', 'Khoa Học Và Thời Đại', 'https://khoahocvathoidai.com'],
  ['thuonghieuvathoidai', 'Thương Hiệu Và Thời Đại', 'https://thuonghieuvathoidai.com'],
  ['phunuvasacdep', 'Phụ Nữ Và Sắc Đẹp', 'https://phunuvasacdep.net'],
  ['kinhdoanhvadautu', 'Kinh Doanh Và Đầu Tư', 'https://kinhdoanhvadautu.com'],
  ['thitruongvataichinh', 'Thị Trường Và Tài Chính', 'https://thitruongvataichinh.com'],
  ['doanhnghiepvacuocsong', 'Doanh Nghiệp Và Cuộc Sống', 'https://doanhnghiepvacuocsong.com'],
  ['doanhnhanvaxahoi', 'Doanh Nhân Và Xã Hội', 'https://doanhnhanvaxahoi.com'],
  ['kinhtevahoinhap', 'Kinh Tế Và Hội Nhập', 'https://kinhtevahoinhap.net'],
] as const satisfies ReadonlyArray<readonly [string, string, string]>;

const seededPress450kPublications: DefaultPressPublication[] = press450kSources.map(([key, name, url], index) => ({
  key,
  name,
  url,
  price: 2_300_000,
  note: 'Báo 450k',
  order: 300 + index * 10,
}));

const seededPress250kPublications: DefaultPressPublication[] = press250kSources.map(([key, name, url], index) => ({
  key,
  name,
  url,
  price: 1_700_000,
  note: 'Báo 250k',
  order: 1000 + index * 10,
}));

const DEFAULT_PRESS_PUBLICATIONS = [
  ...basePressPublications,
  ...seededPress450kPublications,
  ...seededPress250kPublications,
];

const SAMPLE_DOCX_PATH = '/uploads/press/kinhdoanhnews.docx';

let ensurePromise: Promise<void> | null = null;

function normalizePublication(row: Record<string, unknown>): PressPublicationRow {
  return {
    id: Math.trunc(toNumber(row.id, 0)),
    publication_key: String(row.publication_key || ''),
    name: String(row.name || ''),
    url: row.url == null ? null : String(row.url),
    price_vnd: toNumber(row.price_vnd, 0),
    note: row.note == null ? null : String(row.note),
    display_order: Math.trunc(toNumber(row.display_order, 0)),
    status: String(row.status || 'active'),
    created_at: row.created_at as string | Date | undefined,
    updated_at: row.updated_at as string | Date | undefined,
  };
}

function generatePressOrderCode() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NEWS-${time}-${random}`;
}

export function getPressSampleDocxPath() {
  return SAMPLE_DOCX_PATH;
}

export async function ensurePressServiceTables() {
  ensurePromise ||= (async () => {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS press_publications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        publication_key VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(191) NOT NULL,
        url VARCHAR(255) NULL,
        price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        note TEXT NULL,
        display_order INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_press_publications_status_order (status, display_order, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS press_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_code VARCHAR(64) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        publication_id INT NOT NULL,
        publication_name VARCHAR(191) NOT NULL,
        title VARCHAR(191) NULL,
        contact VARCHAR(191) NULL,
        note TEXT NULL,
        docx_path VARCHAR(255) NOT NULL,
        price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        admin_note TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_press_orders_user (user_id),
        INDEX idx_press_orders_publication (publication_id),
        INDEX idx_press_orders_status (status),
        INDEX idx_press_orders_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const now = getUtcDatabaseDateTime();
    for (const item of DEFAULT_PRESS_PUBLICATIONS) {
      await db.$executeRawUnsafe(
        `
          INSERT INTO press_publications
            (publication_key, name, url, price_vnd, note, display_order, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            url = VALUES(url),
            price_vnd = IF(COALESCE(price_vnd, 0) <= 0, VALUES(price_vnd), price_vnd),
            note = IF(COALESCE(note, '') = '', VALUES(note), note),
            display_order = VALUES(display_order),
            status = IF(COALESCE(status, '') = '', 'active', status),
            updated_at = VALUES(updated_at)
        `,
        item.key,
        item.name,
        item.url,
        item.price,
        item.note,
        item.order,
        now,
        now
      );
    }
  })();

  return ensurePromise;
}

export async function listPressPublications(options: { activeOnly?: boolean } = {}) {
  await ensurePressServiceTables();
  const statusSql = options.activeOnly ? "WHERE status = 'active'" : '';
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT *
      FROM press_publications
      ${statusSql}
      ORDER BY display_order ASC, id ASC
    `
  );

  return rows.map(normalizePublication);
}

export async function listUserPressOrders(userId: number) {
  await ensurePressServiceTables();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT id, order_code, user_id, publication_id, publication_name, title, contact,
             note, docx_path, price_vnd, status, admin_note, created_at, updated_at
      FROM press_orders
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `,
    userId
  );

  return rows.map((row) => ({
    ...row,
    id: Math.trunc(toNumber(row.id, 0)),
    user_id: Math.trunc(toNumber(row.user_id, 0)),
    publication_id: Math.trunc(toNumber(row.publication_id, 0)),
    price_vnd: toNumber(row.price_vnd, 0),
  })) as PressOrderRow[];
}

export async function createPressOrder(input: {
  userId: number;
  publicationId: number;
  title?: string;
  contact?: string;
  note?: string;
  docxPath: string;
}) {
  await ensurePressServiceTables();

  return db.$transaction(async (tx) => {
    const publicationRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT *
        FROM press_publications
        WHERE id = ? AND status = 'active'
        LIMIT 1
        FOR UPDATE
      `,
      input.publicationId
    );
    const publication = publicationRows[0] ? normalizePublication(publicationRows[0]) : null;
    if (!publication) {
      throw new Error('Đầu báo không tồn tại hoặc đang tắt');
    }

    const price = Math.max(0, Math.round(publication.price_vnd));
    if (price <= 0) {
      throw new Error('Đầu báo này chưa có giá bán hợp lệ');
    }

    const now = getUtcDatabaseDateTime();
    const updated = await tx.$executeRawUnsafe(
      `
        UPDATE users
        SET balance = balance - ?, last_activity = NOW()
        WHERE id = ? AND balance >= ?
      `,
      price,
      input.userId,
      price
    );
    if (updated < 1) {
      throw new Error('Số dư ví chính không đủ để đặt bài lên báo');
    }

    const balanceRows = await tx.$queryRawUnsafe<Array<{ balance: Prisma.Decimal | number | string }>>(
      'SELECT balance FROM users WHERE id = ? LIMIT 1',
      input.userId
    );
    const balanceAfter = toNumber(balanceRows[0]?.balance, 0);
    const orderCode = generatePressOrderCode();

    await tx.$executeRawUnsafe(
      `
        INSERT INTO press_orders
          (order_code, user_id, publication_id, publication_name, title, contact, note, docx_path, price_vnd, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `,
      orderCode,
      input.userId,
      publication.id,
      publication.name,
      input.title || null,
      input.contact || null,
      input.note || null,
      input.docxPath,
      price,
      now,
      now
    );

    await tx.transactions.create({
      data: {
        user_id: input.userId,
        amount: price,
        balance_after: balanceAfter,
        wallet_type: 'main',
        type: 'order',
        status: 'success',
        content: `Đặt bài lên báo ${publication.name} - mã ${orderCode}`,
      },
    }).catch(() => undefined);

    const orderRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT id, order_code, user_id, publication_id, publication_name, title, contact,
               note, docx_path, price_vnd, status, admin_note, created_at, updated_at
        FROM press_orders
        WHERE order_code = ?
        LIMIT 1
      `,
      orderCode
    );

    return {
      order: orderRows[0] || {
        order_code: orderCode,
        publication_name: publication.name,
        docx_path: input.docxPath,
        price_vnd: price,
        status: 'pending',
      },
      balance_after: balanceAfter,
    };
  });
}
