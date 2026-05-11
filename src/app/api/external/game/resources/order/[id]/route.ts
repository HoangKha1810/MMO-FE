import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateGameApiRequest,
  getExternalGameResourceOrder,
} from '@/lib/game-integration-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateGameApiRequest(req);
  if (!auth.success || !auth.account) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status, headers: noStoreHeaders }
    );
  }

  try {
    const { id } = await context.params;
    const data = await getExternalGameResourceOrder(auth.account.userId, Number(id || 0));
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải trạng thái đơn tài khoản game' },
      { status: 404, headers: noStoreHeaders }
    );
  }
}
