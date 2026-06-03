import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { tableExists } from '@/lib/legacy-modules';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { getSupportTiktokContext } from '@/lib/support-tiktok';
import { toNumber } from '@/lib/utils';

interface LegacyOrderRow extends Record<string, unknown> {
  id: number;
  user_id: number;
  region: string | null;
  service_key: string | null;
  service_name: string | null;
  price: number | string | null;
  status: string | null;
}

const DEFAULT_TIKTOK_SUPPORT_MENUS = [
  { name: 'SP TIK VN', slug: 'vn', displayOrder: 1 },
  { name: 'SP TIK UK', slug: 'uk', displayOrder: 2 },
  { name: 'SP TIK THAI LAN', slug: 'thai', displayOrder: 3 },
  { name: 'SP THUỴ SĨ', slug: 'td', displayOrder: 4 },
  { name: 'SP INDONESIA', slug: 'id', displayOrder: 5 },
];

const DEFAULT_TIKTOK_SUPPORT_SERVICES = [
  {
    regionSlug: 'vn',
    name: 'Chat Support TikTok 0 - 10k FL',
    serviceKey: '0-10k',
    price: 180000,
    displayOrder: 1,
  },
  {
    regionSlug: 'vn',
    name: 'Chat Support TikTok 10k - 20k FL',
    serviceKey: '10_20k',
    price: 320000,
    displayOrder: 2,
  },
  {
    regionSlug: 'vn',
    name: 'Chat Support TikTok 20k - 50k FL',
    serviceKey: '20_50k',
    price: 500000,
    displayOrder: 3,
  },
  {
    regionSlug: 'vn',
    name: 'Chat Support TikTok 50k - 100k FL',
    serviceKey: '50_100k',
    price: 690000,
    displayOrder: 4,
  },
  {
    regionSlug: 'vn',
    name: 'Chat Support TikTok 100k - 190k FL',
    serviceKey: '100_190k',
    price: 889000,
    displayOrder: 5,
  },
  {
    regionSlug: 'uk',
    name: 'Chat Support TikTok 0 - 10k FL',
    serviceKey: '0-10k',
    price: 360000,
    displayOrder: 1,
  },
  {
    regionSlug: 'uk',
    name: 'Chat Support TikTok 10-20k FL',
    serviceKey: '10-20k',
    price: 640000,
    displayOrder: 2,
  },
  {
    regionSlug: 'uk',
    name: 'Chat Support TikTok 20-50K FL',
    serviceKey: '20-50',
    price: 1000000,
    displayOrder: 3,
  },
  {
    regionSlug: 'uk',
    name: 'Chat Support TikTok 50k - 100k FL',
    serviceKey: '50k-100k',
    price: 1380000,
    displayOrder: 4,
  },
  {
    regionSlug: 'thai',
    name: 'Chat Support TikTok 0 - 10k FL',
    serviceKey: '0-10k',
    price: 360000,
    displayOrder: 1,
  },
  {
    regionSlug: 'thai',
    name: 'Chat Support TikTok 10-20K FL',
    serviceKey: '10-20',
    price: 640000,
    displayOrder: 2,
  },
  {
    regionSlug: 'thai',
    name: 'Chat Support TikTok 20-50K FL',
    serviceKey: '20-50',
    price: 1000000,
    displayOrder: 3,
  },
  {
    regionSlug: 'thai',
    name: 'Chat Support TikTok 50k - 100k FL',
    serviceKey: '50k-100k',
    price: 1380000,
    displayOrder: 4,
  },
  {
    regionSlug: 'td',
    name: 'Chat Support TikTok 0 - 10k FL',
    serviceKey: '0-10k',
    price: 360000,
    displayOrder: 1,
  },
  {
    regionSlug: 'td',
    name: 'Chat Support TikTok 10-20K FL',
    serviceKey: '10-20',
    price: 640000,
    displayOrder: 2,
  },
  {
    regionSlug: 'td',
    name: 'Chat Support TikTok 20-50K FL',
    serviceKey: '20-50',
    price: 1000000,
    displayOrder: 3,
  },
  {
    regionSlug: 'td',
    name: 'Chat Support TikTok 50k - 100k FL',
    serviceKey: '50k-100k',
    price: 1380000,
    displayOrder: 4,
  },
  {
    regionSlug: 'id',
    name: 'Chat Support TikTok 0 - 10k FL',
    serviceKey: '0-10k',
    price: 360000,
    displayOrder: 1,
  },
  {
    regionSlug: 'id',
    name: 'Chat Support TikTok 10-20K FL',
    serviceKey: '10-20',
    price: 640000,
    displayOrder: 2,
  },
  {
    regionSlug: 'id',
    name: 'Chat Support TikTok 20-50K FL',
    serviceKey: '20-50',
    price: 1000000,
    displayOrder: 3,
  },
  {
    regionSlug: 'id',
    name: 'Chat Support TikTok 50k - 100k FL',
    serviceKey: '50k-100k',
    price: 1380000,
    displayOrder: 4,
  },
].map((service) => ({
  ...service,
  description: service.name,
}));

function defaultTikTokMenusForResponse() {
  return DEFAULT_TIKTOK_SUPPORT_MENUS.map((menu, index) => ({
    id: -(index + 1),
    name: menu.name,
    slug: menu.slug,
    display_order: menu.displayOrder,
    status: 'active',
  }));
}

function defaultTikTokServicesForResponse() {
  return DEFAULT_TIKTOK_SUPPORT_SERVICES.map((service, index) => ({
    id: -(index + 1),
    region_slug: service.regionSlug,
    name: service.name,
    service_key: service.serviceKey,
    price: service.price,
    description: service.description,
    display_order: service.displayOrder,
    status: 'active',
  }));
}

function findDefaultTikTokService(region: string, serviceKey: string) {
  return defaultTikTokServicesForResponse().find(
    (service) => String(service.region_slug) === region && String(service.service_key) === serviceKey
  );
}

async function getTikTokOrderAllowedStatuses() {
  const rows = await db.$queryRawUnsafe<Array<{ column_type: string }>>(
    `
      SELECT COLUMN_TYPE AS column_type
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'tiktok_support_orders'
        AND column_name = 'status'
      LIMIT 1
    `
  ).catch(() => []);
  const columnType = String(rows[0]?.column_type || '');
  const match = columnType.match(/^enum\((.*)\)$/i);
  if (!match) {
    return null;
  }

  return Array.from(match[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)).map((item) => item[1].replace(/\\'/g, "'"));
}

async function resolveTikTokOrderStatus(preferred: string) {
  const allowed = await getTikTokOrderAllowedStatuses();
  if (!allowed || allowed.includes(preferred)) {
    return preferred;
  }

  const fallbacks: Record<string, string[]> = {
    active: ['completed', 'processing', 'pending'],
    completed: ['active', 'success', 'processing', 'pending'],
    processing: ['pending', 'active', 'completed'],
    pending: ['processing', 'active', 'completed'],
    canceled: ['cancelled', 'expired', 'pending'],
    cancelled: ['canceled', 'expired', 'pending'],
    expired: ['canceled', 'cancelled', 'pending'],
  };

  return fallbacks[preferred]?.find((status) => allowed.includes(status)) || allowed[0] || preferred;
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    undefined
  );
}

async function requireContext(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);
  if (!userId) return { response: NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }) };

  const context = await getSupportTiktokContext(userId, getClientIp(req));
  if (!context) return { response: NextResponse.json({ success: false, message: 'User not found' }, { status: 404 }) };
  if (!context.canAccess) return { response: NextResponse.json({ success: false, message: 'Module đang bảo trì' }, { status: 503 }) };
  return { userId, context };
}

function readBodyValue(body: FormData | Record<string, unknown> | null, key: string) {
  if (body instanceof FormData) return String(body.get(key) || '').trim();
  return String(body?.[key] || '').trim();
}

async function ensureDefaultTikTokSupportServices() {
  const [hasMenuTable, hasServiceTable] = await Promise.all([
    tableExists('tiktok_service_menus'),
    tableExists('tiktok_region_services'),
  ]);

  if (!hasMenuTable || !hasServiceTable) {
    return;
  }

  for (const menu of DEFAULT_TIKTOK_SUPPORT_MENUS) {
    await db.$executeRawUnsafe(
      `
        INSERT INTO tiktok_service_menus (name, slug, display_order, status)
        SELECT ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM tiktok_service_menus WHERE slug = ?
        )
      `,
      menu.name,
      menu.slug,
      menu.displayOrder,
      'active',
      menu.slug
    ).catch(() => undefined);
  }

  await db.$executeRawUnsafe(
    `
      UPDATE tiktok_region_services
      SET status = 'inactive'
      WHERE region_slug = ?
        AND (
          (service_key = ? AND price <= ?)
          OR service_key IN (?, ?, ?)
        )
    `,
    'vn',
    'support-basic',
    50000,
    'support-10-account',
    'support-100-account',
    'support-1-account'
  ).catch(() => undefined);

  for (const service of DEFAULT_TIKTOK_SUPPORT_SERVICES) {
    await db.$executeRawUnsafe(
      `
        INSERT INTO tiktok_region_services
          (region_slug, name, service_key, price, description, display_order, status)
        SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM tiktok_region_services
          WHERE region_slug = ? AND service_key = ?
        )
      `,
      service.regionSlug,
      service.name,
      service.serviceKey,
      service.price,
      service.description,
      service.displayOrder,
      'active',
      service.regionSlug,
      service.serviceKey
    ).catch(() => undefined);
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireContext(req);
  if (auth.response) return auth.response;

  const hasOrders = await tableExists('tiktok_support_orders');
  if (!hasOrders) {
    return NextResponse.json({ success: false, message: 'Thiếu bảng tiktok_support_orders' }, { status: 500 });
  }

  const targetUserId = Number(req.nextUrl.searchParams.get('user_id') || 0);
  const ownerFilter = auth.context!.isSupport && targetUserId > 0 ? targetUserId : auth.userId!;
  const orders = await db.$queryRawUnsafe<LegacyOrderRow[]>(
    `
      SELECT o.*, u.username
      FROM tiktok_support_orders o
      LEFT JOIN users u ON u.id = o.user_id
      WHERE ${auth.context!.isSupport && targetUserId === 0 ? '1 = 1' : 'o.user_id = ?'}
      ORDER BY o.updated_at DESC, o.id DESC
      LIMIT 120
    `,
    ...(auth.context!.isSupport && targetUserId === 0 ? [] : [ownerFilter])
  );

  await ensureDefaultTikTokSupportServices();

  const hasRegionServices = await tableExists('tiktok_region_services');
  const dbServices = hasRegionServices
    ? await db.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT s.id, s.region_slug, s.name, s.service_key, s.price, s.description, s.display_order, s.status
        FROM tiktok_region_services s
        WHERE s.status = 'active'
          AND (
            NOT EXISTS (SELECT 1 FROM tiktok_service_menus)
            OR EXISTS (
              SELECT 1
              FROM tiktok_service_menus m
              WHERE m.slug = s.region_slug AND m.status = 'active'
            )
          )
        ORDER BY
          COALESCE((SELECT m.display_order FROM tiktok_service_menus m WHERE m.slug = s.region_slug LIMIT 1), 999),
          s.display_order ASC,
          s.id ASC
      `).catch(() => [])
    : [];

  const hasMenus = await tableExists('tiktok_service_menus');
  const dbMenus = hasMenus
    ? await db.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT id, name, slug, display_order, status
        FROM tiktok_service_menus
        WHERE status = 'active'
        ORDER BY display_order ASC, id ASC
      `).catch(() => [])
    : [];
  const services = dbServices.length > 0 ? dbServices : defaultTikTokServicesForResponse();
  const menus = dbMenus.length > 0 ? dbMenus : defaultTikTokMenusForResponse();

  return NextResponse.json({ success: true, data: { orders, services, menus, is_support: auth.context!.isSupport } });
}

export async function POST(req: NextRequest) {
  const auth = await requireContext(req);
  if (auth.response) return auth.response;
  if (!(await tableExists('tiktok_support_orders'))) {
    return NextResponse.json({ success: false, message: 'Thiếu bảng tiktok_support_orders' }, { status: 500 });
  }

  const contentType = req.headers.get('content-type') || '';
  const body = contentType.includes('multipart/form-data')
    ? await req.formData().catch(() => null)
    : await req.json().catch(() => null);
  const action = readBodyValue(body, 'action') || 'create';

  if (action === 'update_status') {
    if (!auth.context!.isSupport) {
      return NextResponse.json({ success: false, message: 'Không có quyền cập nhật trạng thái đơn' }, { status: 403 });
    }

    const orderId = Number(readBodyValue(body, 'order_id') || 0);
    const requestedStatus = readBodyValue(body, 'status').toLowerCase();
    const statusMap: Record<string, string> = {
      pending: 'pending',
      active: 'active',
      processing: 'processing',
      success: 'completed',
      completed: 'completed',
      canceled: 'canceled',
      cancelled: 'canceled',
    };
    const nextStatus = statusMap[requestedStatus];

    if (!orderId || !nextStatus) {
      return NextResponse.json({ success: false, message: 'Thiếu order_id hoặc status không hợp lệ' }, { status: 400 });
    }

    const dbStatus = await resolveTikTokOrderStatus(nextStatus);
    const updated = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<LegacyOrderRow[]>(
        `
          SELECT *
          FROM tiktok_support_orders
          WHERE id = ?
          LIMIT 1
        `,
        orderId
      );
      const order = rows[0];
      if (!order) {
        throw new Error('Không tìm thấy đơn TikTok');
      }

      if (nextStatus === 'completed' || nextStatus === 'active') {
        await tx.$executeRawUnsafe(
          `
            UPDATE tiktok_support_orders
            SET status = ?,
                ngay_gia_han = COALESCE(ngay_gia_han, NOW()),
                ngay_het_han = CASE
                  WHEN ngay_het_han IS NULL OR ngay_het_han < NOW() THEN DATE_ADD(NOW(), INTERVAL 30 DAY)
                  ELSE ngay_het_han
                END,
                updated_at = NOW()
            WHERE id = ?
          `,
          dbStatus,
          orderId
        );
      } else {
        await tx.$executeRawUnsafe(
          `
            UPDATE tiktok_support_orders
            SET status = ?, updated_at = NOW()
            WHERE id = ?
          `,
          dbStatus,
          orderId
        );
      }

      const updatedRows = await tx.$queryRawUnsafe<LegacyOrderRow[]>(
        `
          SELECT *
          FROM tiktok_support_orders
          WHERE id = ?
          LIMIT 1
        `,
        orderId
      );
      return updatedRows[0] || null;
    });

    return NextResponse.json({
      success: true,
      message: 'Đã cập nhật trạng thái đơn TikTok',
      data: updated,
    });
  }

  if (action === 'renew') {
    const orderId = Number(readBodyValue(body, 'order_id') || 0);
    if (!orderId) return NextResponse.json({ success: false, message: 'Thiếu order_id' }, { status: 400 });
    const renewedStatus = await resolveTikTokOrderStatus('completed');

    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<LegacyOrderRow[]>(
        `
          SELECT *
          FROM tiktok_support_orders
          WHERE id = ?
            ${auth.context!.isSupport ? '' : 'AND user_id = ?'}
          LIMIT 1
        `,
        ...(auth.context!.isSupport ? [orderId] : [orderId, auth.userId])
      );
      const order = rows[0];
      if (!order) throw new Error('Không tìm thấy đơn TikTok');

      const settings = await getLegacySettingsMap();
      const vatPercent = getVatPercent(settings);
      const serviceRows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `
          SELECT price
          FROM tiktok_region_services
          WHERE region_slug = ?
            AND service_key = ?
            AND status = 'active'
          LIMIT 1
        `,
        String(order.region || ''),
        String(order.service_key || '')
      );
      const renewSubtotal = Math.max(
        0,
        toNumber(serviceRows[0]?.price, toNumber(order.price, 0))
      );
      const renewVatAmount = Math.round((renewSubtotal * vatPercent) / 100);
      const totalPrice = renewSubtotal + renewVatAmount;
      const user = await tx.users.findUnique({ where: { id: Number(order.user_id) }, select: { balance: true } });
      if (!user) throw new Error('Không tìm thấy user');
      const nextBalance = toNumber(user.balance, 0) - totalPrice;
      if (nextBalance < 0) throw new Error('Số dư không đủ để gia hạn');

      await tx.users.update({ where: { id: Number(order.user_id) }, data: { balance: nextBalance, last_activity: new Date() } });
      await tx.transactions.create({
        data: {
          user_id: Number(order.user_id),
          amount: totalPrice,
          balance_after: nextBalance,
          type: 'order',
          status: 'success',
          content: `Gia hạn Support TikTok #${orderId}`,
        },
      }).catch(() => undefined);
      await tx.$executeRawUnsafe(
        `
          UPDATE tiktok_support_orders
          SET status = ?,
              ngay_gia_han = NOW(),
              ngay_het_han = DATE_ADD(GREATEST(COALESCE(ngay_het_han, NOW()), NOW()), INTERVAL 30 DAY),
              updated_at = NOW()
          WHERE id = ?
        `,
        renewedStatus,
        orderId
      );
      return { order_id: orderId, balance_after: nextBalance };
    });

    return NextResponse.json({ success: true, message: 'Đã gia hạn đơn TikTok', data: result });
  }

  const region = readBodyValue(body, 'region');
  const serviceKey = readBodyValue(body, 'service_key');
  const tiktokId = readBodyValue(body, 'tiktok_id');
  const buyerName = readBodyValue(body, 'buyer_name');
  const buyerContact = readBodyValue(body, 'buyer_contact');

  if (!region || !serviceKey || !tiktokId) {
    return NextResponse.json({ success: false, message: 'Thiếu region, service_key hoặc TikTok ID' }, { status: 400 });
  }

  if (!(await tableExists('tiktok_region_services'))) {
    return NextResponse.json({ success: false, message: 'Thiếu bảng tiktok_region_services' }, { status: 500 });
  }

  await ensureDefaultTikTokSupportServices();
  const initialOrderStatus = await resolveTikTokOrderStatus('completed');

  const created = await db.$transaction(async (tx) => {
    const serviceRows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT *
        FROM tiktok_region_services
        WHERE region_slug = ?
          AND service_key = ?
          AND status = 'active'
        LIMIT 1
      `,
      region,
      serviceKey
    );
    const service = serviceRows[0] || findDefaultTikTokService(region, serviceKey);
    if (!service) throw new Error('Không tìm thấy dịch vụ TikTok đang bật');

    const settings = await getLegacySettingsMap();
    const vatPercent = getVatPercent(settings);
    const subtotal = Math.max(0, toNumber(service.price, 0));
    const vatAmount = Math.round((subtotal * vatPercent) / 100);
    const totalPrice = subtotal + vatAmount;
    const user = await tx.users.findUnique({ where: { id: auth.userId! }, select: { balance: true } });
    if (!user) throw new Error('Không tìm thấy user');
    const nextBalance = toNumber(user.balance, 0) - totalPrice;
    if (nextBalance < 0) throw new Error('Số dư không đủ để tạo đơn');

    await tx.users.update({ where: { id: auth.userId! }, data: { balance: nextBalance, last_activity: new Date() } });
    await tx.transactions.create({
      data: {
        user_id: auth.userId!,
        amount: totalPrice,
        balance_after: nextBalance,
        type: 'order',
        status: 'success',
        content: `Tạo đơn Support TikTok ${service.service_key || serviceKey}`,
      },
    }).catch(() => undefined);
    await tx.$executeRawUnsafe(
      `
        INSERT INTO tiktok_support_orders
          (user_id, region, service_key, service_name, tiktok_id, buyer_name, buyer_contact, price, status, ngay_gia_han, ngay_het_han, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())
      `,
      auth.userId!,
      region,
      serviceKey,
      String(service.name || serviceKey),
      tiktokId,
      buyerName,
      buyerContact,
      totalPrice,
      initialOrderStatus
    );
    const rows = await tx.$queryRawUnsafe<LegacyOrderRow[]>('SELECT * FROM tiktok_support_orders WHERE id = LAST_INSERT_ID() LIMIT 1');
    return { order: rows[0] || null, balance_after: nextBalance, subtotal, vat_amount: vatAmount, total_to_pay: totalPrice };
  });

  return NextResponse.json({
    success: true,
    message: 'Mua gói Support TikTok thành công. Bạn có thể chat ngay bây giờ.',
    data: created,
  });
}
