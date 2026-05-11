import { NextRequest, NextResponse } from 'next/server';
import { authenticateGameApiRequest, getGameApiAccountSummary } from '@/lib/game-integration-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function GET(req: NextRequest) {
  const auth = await authenticateGameApiRequest(req);
  if (!auth.success || !auth.account) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status, headers: noStoreHeaders }
    );
  }

  const data = await getGameApiAccountSummary(auth.account.userId);
  return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
}
