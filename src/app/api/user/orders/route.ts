import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { safeRows, safeRowsFromTable } from '@/lib/legacy-modules';
import { normalizeSmmOrderStatus } from '@/lib/smm-status';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '20', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const type = (searchParams.get('type') || 'all').toLowerCase();

  const skip = (page - 1) * perPage;

  try {
    if (type === 'all') {
      const [smmOrders, autoOrders, metaOrders, resourceOrders, gameOrders, cardOrders] = await Promise.all([
        safeRows('SELECT id, api_order_id, service_name, quantity, price, status, created_at FROM smm_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', userId),
        safeRows('SELECT id, product_id, variant_id, price, status, created_at FROM automxh_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', userId),
        safeRowsFromTable('meta_support_orders', 'SELECT id, quantity, price, status, created_at FROM meta_support_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', userId),
        safeRows('SELECT o.id, o.resource_id, o.quantity, o.total_price, o.status, o.created_at, r.title FROM resource_orders o LEFT JOIN mmo_resources r ON r.id = o.resource_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 100', userId),
        safeRows('SELECT o.id, o.item_id, o.amount, o.status, o.created_at, i.title FROM game_market_orders o LEFT JOIN game_market_items i ON i.id = o.item_id WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 100', userId),
        safeRowsFromTable('card_orders', 'SELECT id, type, telco, serial, amount, status, created_at FROM card_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', userId),
      ]);

      const rows = [
        ...smmOrders.map((item) => ({
          id: `smm-${item.id}`,
          source_id: Number(item.id),
          type: 'smm',
          title: String(item.service_name || `SMM #${item.id}`),
          code: String(item.api_order_id || item.id),
          amount: toNumber(item.price, 0),
          quantity: toNumber(item.quantity, 0),
          status: normalizeSmmOrderStatus(item.status),
          created_at: item.created_at,
        })),
        ...autoOrders.map((item) => ({
          id: `automxh-${item.id}`,
          source_id: Number(item.id),
          type: 'automxh',
          title: `Auto MXH #${item.product_id || item.variant_id || item.id}`,
          code: String(item.id),
          amount: toNumber(item.price, 0),
          status: String(item.status || 'pending'),
          created_at: item.created_at,
        })),
        ...metaOrders.map((item) => ({
          id: `meta-${item.id}`,
          source_id: Number(item.id),
          type: 'meta',
          title: `Auto kích nút Meta #${item.id} - ${item.quantity || 1} tài khoản`,
          code: String(item.id),
          amount: toNumber(item.price, 0),
          quantity: toNumber(item.quantity, 0),
          status: String(item.status || 'pending'),
          created_at: item.created_at,
        })),
        ...resourceOrders.map((item) => ({
          id: `resource-${item.id}`,
          source_id: Number(item.id),
          type: 'resource',
          title: String(item.title || `Resource #${item.resource_id}`),
          code: String(item.id),
          amount: toNumber(item.total_price, 0),
          quantity: toNumber(item.quantity, 0),
          status: String(item.status || 'pending'),
          created_at: item.created_at,
        })),
        ...gameOrders.map((item) => ({
          id: `game-${item.id}`,
          source_id: Number(item.id),
          type: 'game',
          title: String(item.title || `Game #${item.item_id}`),
          code: String(item.id),
          amount: toNumber(item.amount, 0),
          status: String(item.status || 'processing'),
          created_at: item.created_at,
        })),
        ...cardOrders.map((item) => ({
          id: `card-${item.id}`,
          source_id: Number(item.id),
          type: 'card',
          title: `${String(item.telco || item.type || 'Card')} ${String(item.serial || '')}`.trim(),
          code: String(item.id),
          amount: toNumber(item.amount, 0),
          status: String(item.status || 'pending'),
          created_at: item.created_at,
        })),
      ]
        .filter((item) => !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.code.includes(search))
        .filter((item) => !status || item.status === status)
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

      return NextResponse.json({
        success: true,
        data: rows.slice(skip, skip + perPage),
        pagination: {
          current_page: page,
          total_pages: Math.max(1, Math.ceil(rows.length / perPage)),
          total_items: rows.length,
          per_page: perPage,
        },
      }, { headers: noStoreHeaders });
    }

    const where: Record<string, unknown> = { user_id: userId };
    if (search) {
      where.OR = [
        { service_name: { contains: search } },
        { link: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      db.smm_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: perPage,
      }),
      db.smm_orders.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: orders.map((order) => ({
        ...order,
        price: toNumber(order.price, 0),
        balance_after: toNumber(order.balance_after, 0),
        refund_amount: toNumber(order.refund_amount, 0),
        created_at: serializeDatabaseDateTime(order.created_at),
      })),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / perPage),
        total_items: total,
        per_page: perPage,
      },
    }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500, headers: noStoreHeaders });
  }
}
