import { NextRequest, NextResponse } from 'next/server';
import {
  BlueTickPurchaseError,
  getBlueTickSnapshot,
  purchaseBlueTick,
} from '@/lib/blue-tick';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập.' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const data = await getBlueTickSnapshot(userId);
    return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được trạng thái tick xanh.';
    const status = error instanceof BlueTickPurchaseError ? error.status : 500;
    return NextResponse.json({ success: false, message }, { status, headers: noStoreHeaders });
  }
}

export async function POST(_req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập.' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const data = await purchaseBlueTick(userId);
    return NextResponse.json({
      success: true,
      message: 'Đã kích hoạt tick xanh 1 tháng.',
      data,
    }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể mua tick xanh lúc này.';
    const status = error instanceof BlueTickPurchaseError ? error.status : 500;
    return NextResponse.json({ success: false, message }, { status, headers: noStoreHeaders });
  }
}
