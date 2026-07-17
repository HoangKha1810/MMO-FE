import { NextResponse } from 'next/server';
import { ensureGameApiKeyForUser } from '@/lib/game-integration-api';
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
    return NextResponse.json(
      { success: false, message: 'Vui lòng đăng nhập' },
      { status: 401, headers: noStoreHeaders }
    );
  }

  try {
    const account = await ensureGameApiKeyForUser(userId);

    return NextResponse.json(
      {
        success: true,
        apikey: String(account.api_key || ''),
        status: String(account.api_status || 'active'),
        last_used_at: account.last_used_at || null,
        created_at: account.created_at || null,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Không thể tải apikey',
      },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
