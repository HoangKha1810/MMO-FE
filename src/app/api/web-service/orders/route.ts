import { NextResponse } from 'next/server';
import { createWebServiceOrder, listUserWebServiceOrders } from '@/lib/web-service';
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
    const orders = await listUserWebServiceOrders(userId);
    return NextResponse.json({ success: true, data: orders }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được lịch sử đặt dịch vụ web';
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
      return NextResponse.json({ success: false, message: 'Thiếu gói dịch vụ cần đặt' }, { status: 400, headers: noStoreHeaders });
    }

    if (body?.confirm !== true) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng xác nhận gửi yêu cầu dịch vụ web' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const order = await createWebServiceOrder(userId, {
      packageId,
      contact: body?.contact,
      desiredDomain: body?.desired_domain,
      requirement: body?.requirement,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã gửi yêu cầu dịch vụ web, admin sẽ liên hệ xử lý',
      data: { order },
    }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tạo được yêu cầu dịch vụ web';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
