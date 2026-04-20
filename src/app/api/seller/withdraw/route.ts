import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSellerWithdrawal } from '@/lib/legacy-modules';
import { toNumber } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  try {
    const transaction = await createSellerWithdrawal(
      userId,
      toNumber(body.amount, 0),
      String(body.content || '').trim()
    );
    return NextResponse.json({ success: true, message: 'Đã tạo yêu cầu rút tiền', data: transaction });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Không thể rút tiền' }, { status: 400 });
  }
}
