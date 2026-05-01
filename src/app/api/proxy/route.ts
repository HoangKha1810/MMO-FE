import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getProxyMarketplaceOverview, runProxyUserAction } from '@/lib/proxy-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

async function getUserId() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const data = await getProxyMarketplaceOverview(userId);
    return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải dữ liệu proxy' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = await runProxyUserAction(userId, body);
    return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý thao tác proxy' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}
