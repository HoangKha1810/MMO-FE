import { NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { db } from '@/lib/db';
import { getSmmProviderBalance } from '@/lib/smm-provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.users.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || String(user.role).toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Chỉ admin mới xem được số dư nguồn API' },
        { status: 403 }
      );
    }

    const data = await getSmmProviderBalance();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể lấy số dư SubmetaVip';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
