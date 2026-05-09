import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { tableExists } from '@/lib/legacy-modules';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' }, { status: 401 });
  }

  try {
    if (!(await tableExists('card_orders'))) {
      return NextResponse.json(
        { success: false, message: 'Module thẻ cào chưa được cấu hình trong cơ sở dữ liệu hiện tại' },
        { status: 503 }
      );
    }

    const { telco, amount, serial, pin, type } = await req.json();

    if (!telco || !amount || !serial || !pin) {
      return NextResponse.json({ success: false, message: 'Thiếu thông tin thẻ' }, { status: 400 });
    }

    const cardOrder = await db.card_orders.create({
      data: {
        user_id: userId,
        type: type === 'buy' ? 'buy' : 'exchange',
        telco: String(telco),
        card_amount: Number(amount),
        amount: Number(amount),
        serial: String(serial),
        pin: String(pin),
        status: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Yêu cầu ${type === 'buy' ? 'mua mã' : 'đổi thẻ'} đã được ghi nhận`,
      data: cardOrder,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Không thể tạo giao dịch thẻ' }, { status: 500 });
  }
}
