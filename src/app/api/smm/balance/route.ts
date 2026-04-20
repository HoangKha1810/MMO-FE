import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getSmmProviderBalance } from '@/lib/smm-provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

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
