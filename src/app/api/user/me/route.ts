import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const user = await db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        balance: true,
        game_balance: true,
        rank: true,
        role: true,
        is_blue_tick: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404, headers: noStoreHeaders });
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        avatar: buildLegacyAssetUrl(user.avatar) || undefined,
        balance: toNumber(user.balance, 0),
        game_balance: toNumber(user.game_balance, 0),
      },
    }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500, headers: noStoreHeaders });
  }
}
