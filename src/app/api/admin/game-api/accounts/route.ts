import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import {
  listAdminGameApiAccounts,
  provisionMissingGameApiKeys,
  rotateGameApiKeyForUser,
  updateGameApiKeyStatus,
} from '@/lib/game-integration-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) {
    return auth.response;
  }

  try {
    const data = await listAdminGameApiAccounts({
      search: req.nextUrl.searchParams.get('search') || '',
      page: Number(req.nextUrl.searchParams.get('page') || 1),
      perPage: Number(req.nextUrl.searchParams.get('per_page') || 25),
      syncMissing: req.nextUrl.searchParams.get('sync_missing') === '1',
    });

    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải Game API accounts' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase();

    if (action === 'provision-missing') {
      const data = await provisionMissingGameApiKeys();
      return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
    }

    const userId = Number(body.user_id || body.userId || 0);
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Thiếu user_id' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (action === 'rotate') {
      const data = await rotateGameApiKeyForUser(userId);
      return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
    }

    if (action === 'set-status') {
      const data = await updateGameApiKeyStatus(
        userId,
        String(body.status || '').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active'
      );
      return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
    }

    return NextResponse.json(
      { success: false, message: 'Action không được hỗ trợ' },
      { status: 400, headers: noStoreHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý Game API accounts' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}
