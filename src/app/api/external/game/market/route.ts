import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateGameApiRequest,
  createExternalGameMarketOrder,
  listExternalGameMarketItems,
} from '@/lib/game-integration-api';

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

  try {
    const data = await listExternalGameMarketItems(req.nextUrl.searchParams);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải game market' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await authenticateGameApiRequest(req, body);
  if (!auth.success || !auth.account) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status, headers: noStoreHeaders }
    );
  }

  try {
    const data = await createExternalGameMarketOrder(auth.account.userId, {
      itemId: Number(body.item_id || body.itemId || 0),
    });
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tạo đơn game market' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}
