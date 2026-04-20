import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { normalizeLegacyRows } from '@/lib/legacy-modules';

async function getUserId() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT
        c.id,
        c.item_id,
        c.item_type,
        c.created_at,
        r.id AS resource_id,
        r.title,
        r.category,
        r.price,
        r.stock
      FROM cart_items c
      LEFT JOIN mmo_resources r ON r.id = c.item_id AND c.item_type IN ('resource', 'mmo_resource')
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `, userId);

    const items = normalizeLegacyRows(rows).map((row) => ({
      id: Number(row.id),
      quantity: 1,
      resource: {
        id: Number(row.resource_id || row.item_id),
        title: String(row.title || `Item #${row.item_id}`),
        category: row.category ? String(row.category) : null,
        price: Number(row.price || 0),
        stock: Number(row.stock || 0),
      },
    }));

    return NextResponse.json({ success: true, data: items });
  } catch {
    return NextResponse.json({ success: false, message: 'Không thể tải giỏ hàng' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { resource_id, quantity } = await req.json();
    const resourceId = Number(resource_id);
    const qty = Math.max(1, Number(quantity || 1));

    if (!resourceId) {
      return NextResponse.json({ success: false, message: 'Resource không hợp lệ' }, { status: 400 });
    }

    const resource = await db.$queryRawUnsafe<Array<{ id: number }>>(
      "SELECT id FROM mmo_resources WHERE id = ? AND status = 'active' AND COALESCE(is_deleted, 0) = 0 LIMIT 1",
      resourceId
    );
    if (!resource[0]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy tài nguyên' }, { status: 404 });
    }

    const existing = await db.$queryRawUnsafe<Array<{ id: number }>>(
      "SELECT id FROM cart_items WHERE user_id = ? AND item_id = ? AND item_type IN ('resource', 'mmo_resource') LIMIT 1",
      userId,
      resourceId
    );

    if (existing[0]) {
      return NextResponse.json({ success: true, message: 'Sản phẩm đã có trong giỏ hàng', data: existing[0] });
    }

    await db.$executeRawUnsafe(
      "INSERT INTO cart_items (user_id, item_id, item_type, created_at) VALUES (?, ?, 'resource', NOW())",
      userId,
      resourceId
    );

    return NextResponse.json({
      success: true,
      message: 'Đã thêm vào giỏ hàng',
      data: { resource_id: resourceId, quantity: qty },
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Không thể thêm giỏ hàng' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { item_id } = await req.json();
    const itemId = Number(item_id);

    const existing = await db.$queryRawUnsafe<Array<{ id: number }>>(
      'SELECT id FROM cart_items WHERE id = ? AND user_id = ? LIMIT 1',
      itemId,
      userId
    );

    if (!existing[0]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy item' }, { status: 404 });
    }

    await db.$executeRawUnsafe('DELETE FROM cart_items WHERE id = ? AND user_id = ?', itemId, userId);

    return NextResponse.json({ success: true, message: 'Đã xóa khỏi giỏ hàng' });
  } catch {
    return NextResponse.json({ success: false, message: 'Không thể xóa item' }, { status: 500 });
  }
}
