import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { tableExists } from '@/lib/legacy-modules';
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

  const services = await tableExists('tiktok_region_services')
    ? db.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT id, region_slug, name, service_key, price, description, status
        FROM tiktok_region_services
        WHERE status = 'active'
        ORDER BY region_slug ASC, display_order ASC, id ASC
      `).catch(() => [])
    : [];

  const menus = await tableExists('tiktok_service_menus')
    ? db.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT id, name, slug, status
        FROM tiktok_service_menus
        WHERE status = 'active'
        ORDER BY display_order ASC, id ASC
      `).catch(() => [])
    : [];

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

  if (action === 'renew') {
    const orderId = Number(readBodyValue(body, 'order_id') || 0);
    if (!orderId) return NextResponse.json({ success: false, message: 'Thiếu order_id' }, { status: 400 });

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

      const price = Math.max(0, toNumber(order.price, 0));
      const user = await tx.users.findUnique({ where: { id: Number(order.user_id) }, select: { balance: true } });
      if (!user) throw new Error('Không tìm thấy user');
      const nextBalance = toNumber(user.balance, 0) - price;
      if (nextBalance < 0) throw new Error('Số dư không đủ để gia hạn');

      await tx.users.update({ where: { id: Number(order.user_id) }, data: { balance: nextBalance, last_activity: new Date() } });
      await tx.transactions.create({
        data: {
          user_id: Number(order.user_id),
          amount: price,
          balance_after: nextBalance,
          type: 'order',
          status: 'success',
          content: `Gia hạn Support TikTok #${orderId}`,
        },
      }).catch(() => undefined);
      await tx.$executeRawUnsafe(
        `
          UPDATE tiktok_support_orders
          SET status = 'active',
              ngay_gia_han = NOW(),
              ngay_het_han = DATE_ADD(GREATEST(COALESCE(ngay_het_han, NOW()), NOW()), INTERVAL 30 DAY),
              updated_at = NOW()
          WHERE id = ?
        `,
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
    const service = serviceRows[0];
    if (!service) throw new Error('Không tìm thấy dịch vụ TikTok đang bật');

    const price = Math.max(0, toNumber(service.price, 0));
    const user = await tx.users.findUnique({ where: { id: auth.userId! }, select: { balance: true } });
    if (!user) throw new Error('Không tìm thấy user');
    const nextBalance = toNumber(user.balance, 0) - price;
    if (nextBalance < 0) throw new Error('Số dư không đủ để tạo đơn');

    await tx.users.update({ where: { id: auth.userId! }, data: { balance: nextBalance, last_activity: new Date() } });
    await tx.transactions.create({
      data: {
        user_id: auth.userId!,
        amount: price,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())
      `,
      auth.userId!,
      region,
      serviceKey,
      String(service.name || serviceKey),
      tiktokId,
      buyerName,
      buyerContact,
      price
    );
    const rows = await tx.$queryRawUnsafe<LegacyOrderRow[]>('SELECT * FROM tiktok_support_orders WHERE id = LAST_INSERT_ID() LIMIT 1');
    return { order: rows[0] || null, balance_after: nextBalance };
  });

  return NextResponse.json({
    success: true,
    message: 'Mua gói Support TikTok thành công. Bạn có thể chat ngay bây giờ.',
    data: created,
  });
}
