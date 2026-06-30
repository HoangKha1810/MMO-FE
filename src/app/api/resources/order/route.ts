import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { purchaseResource, usesGameWalletResource } from '@/lib/resource-actions';
import { db } from '@/lib/db';
import { getLegacySettingsMap, isResourcesContactAdminMode } from '@/lib/legacy-settings';

async function getUserId() {
  return getVerifiedSessionUserId();
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const resourceId = Number(body.resource_id || 0);
    const quantity = Number(body.quantity || 1);

    if (!resourceId) {
      return NextResponse.json({ success: false, message: 'Thiếu resource ID' }, { status: 400 });
    }

    const resources = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT id, api_account_kind FROM mmo_resources WHERE id = ? AND COALESCE(is_deleted, 0) = 0 LIMIT 1',
      resourceId
    );
    const resource = resources[0];
    if (!resource) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy tài nguyên' }, { status: 404 });
    }

    if (!usesGameWalletResource(resource) && isResourcesContactAdminMode(await getLegacySettingsMap())) {
      return NextResponse.json(
        { success: false, message: 'Đặt mua tài nguyên liền tay - Liên hệ qua Telegram để admin xác nhận tồn kho, giá và cách bàn giao.' },
        { status: 403 }
      );
    }

    const data = await purchaseResource(userId, resourceId, quantity);
    return NextResponse.json({ success: true, message: 'Mua tài nguyên thành công', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể mua tài nguyên' },
      { status: 400 }
    );
  }
}
