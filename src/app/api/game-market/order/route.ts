import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { purchaseGameItem, rateGameOrder } from '@/lib/game-market-actions';

async function getUserId() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || 'purchase').trim().toLowerCase();

    if (action === 'rate') {
      const orderId = Number(body.order_id || 0);
      if (!orderId) {
        return NextResponse.json({ success: false, message: 'Thiếu order ID' }, { status: 400 });
      }
      const data = await rateGameOrder(userId, orderId, Number(body.rating || 5), String(body.review || ''));
      return NextResponse.json({ success: true, message: 'Đã gửi đánh giá cho đơn hàng', data });
    }

    const itemId = Number(body.item_id || 0);
    if (!itemId) {
      return NextResponse.json({ success: false, message: 'Thiếu item ID' }, { status: 400 });
    }

    const data = await purchaseGameItem(userId, itemId);
    return NextResponse.json({ success: true, message: 'Mua sản phẩm thành công', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý đơn game-market' },
      { status: 400 }
    );
  }
}
