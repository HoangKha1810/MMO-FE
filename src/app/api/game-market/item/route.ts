import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdateGameItem, setGameItemState } from '@/lib/game-market-actions';

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
    const action = String(body.action || 'create').trim().toLowerCase();
    const itemId = Number(body.item_id || body.id || 0);

    if (action === 'pin' || action === 'unpin' || action === 'hide') {
      if (!itemId) {
        return NextResponse.json({ success: false, message: 'Thiếu item ID' }, { status: 400 });
      }
      const data = await setGameItemState(userId, itemId, action);
      return NextResponse.json({ success: true, message: 'Đã cập nhật trạng thái sản phẩm', data });
    }

    const data = await createOrUpdateGameItem(userId, {
      itemId: action === 'update' ? itemId : undefined,
      title: String(body.title || ''),
      category: String(body.category || ''),
      tag: String(body.tag || ''),
      badge: String(body.badge || ''),
      badgeColor: String(body.badge_color || ''),
      price: Number(body.price || 0),
      stock: Number(body.stock || 1),
      prepTime: String(body.prep_time || ''),
      originalPrice: Number(body.original_price || 0) || undefined,
      thumbnail: String(body.thumbnail || ''),
      description: String(body.description || ''),
      images: String(body.images || ''),
      features: String(body.features || ''),
      rank: String(body.rank || ''),
      skins: String(body.skins || ''),
      champs: String(body.champs || ''),
      accountDetails: String(body.account_details || ''),
      deliveryMethod: String(body.delivery_method || 'manual'),
    });

    return NextResponse.json({ success: true, message: action === 'update' ? 'Đã cập nhật sản phẩm' : 'Đã tạo sản phẩm', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý sản phẩm game-market' },
      { status: 400 }
    );
  }
}
