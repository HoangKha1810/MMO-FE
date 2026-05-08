// src/app/api/user/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

export async function GET() {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.users.findUnique({
      where: { id: userId },
      select: { balance: true, game_balance: true, status: true, lock_reason: true, locked_at: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      balance: toNumber(user.balance, 0),
      game_balance: toNumber(user.game_balance, 0),
      status: user.status,
      lock_reason: user.lock_reason,
      locked_at: user.locked_at,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
