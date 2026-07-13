import { NextResponse } from 'next/server';
import { createTikTokChannelOrder, listUserTikTokChannelOrders } from '@/lib/tiktok-channel';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

async function getUserId() {
  return getVerifiedSessionUserId();
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Bạn cần đăng nhập' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const orders = await listUserTikTokChannelOrders(userId);
    return NextResponse.json({ success: true, data: orders }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được đơn Kênh TikTok';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Bạn cần đăng nhập' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const productId = Math.trunc(toNumber(body?.product_id, 0));
    if (!productId) {
      return NextResponse.json({ success: false, message: 'Thiếu kênh TikTok cần mua' }, { status: 400, headers: noStoreHeaders });
    }
    if (body?.confirm !== true) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng xác nhận đồng ý thanh toán trước khi mua kênh TikTok' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const result = await createTikTokChannelOrder(userId, productId);
    return NextResponse.json({
      success: true,
      message: 'Đã mua kênh TikTok, credential đã được lưu trong lịch sử đơn',
      data: result,
    }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không mua được kênh TikTok';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
