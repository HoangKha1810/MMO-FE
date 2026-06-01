import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createMetaSupportOrder,
  listMetaSupportOrders,
  META_SUPPORT_PACKAGES,
} from '@/lib/meta-support';

async function requireUserId() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);
  if (!userId) {
    return {
      userId: 0,
      response: NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { userId, response: null };
}

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth.response) return auth.response;

    const orders = await listMetaSupportOrders(auth.userId);
    return NextResponse.json({ success: true, data: { orders, packages: META_SUPPORT_PACKAGES } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không tải được đơn Auto kích nút Meta' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserId();
    if (auth.response) return auth.response;

    const body = await req.json().catch(() => ({}));
    const result = await createMetaSupportOrder({
      userId: auth.userId,
      quantity: body.quantity,
      contact: body.contact,
      gmail: body.gmail,
      note: body.note,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã gửi yêu cầu Auto kích nút Meta. Admin sẽ xử lý đơn của bạn.',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tạo được đơn Auto kích nút Meta';
    const status = message.includes('không đủ') ? 402 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
