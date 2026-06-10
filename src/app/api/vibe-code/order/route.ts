import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createVibeCodeOrder, listUserVibeCodeOrders } from '@/lib/vibe-code';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

async function getUserId() {
  const cookieStore = await cookies();
  return Math.trunc(toNumber(cookieStore.get('user_id')?.value, 0));
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Bạn cần đăng nhập' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const orders = await listUserVibeCodeOrders(userId);
    return NextResponse.json({ success: true, data: orders }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được đơn Vibe Code';
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
    const packageId = Math.trunc(toNumber(body?.package_id, 0));
    if (!packageId) {
      return NextResponse.json({ success: false, message: 'Thiếu gói Vibe Code cần mua' }, { status: 400, headers: noStoreHeaders });
    }

    const result = await createVibeCodeOrder(userId, packageId);
    return NextResponse.json({
      success: true,
      message: 'Đã mua gói Vibe Code, hãy gửi mã đơn cho admin để được hướng dẫn',
      data: result,
    }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tạo được đơn Vibe Code';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
