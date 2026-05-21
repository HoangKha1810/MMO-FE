import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { purchaseResource } from '@/lib/resource-actions';
import { getLegacySettingsMap, isResourcesContactAdminMode } from '@/lib/legacy-settings';

async function getUserId() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (isResourcesContactAdminMode(await getLegacySettingsMap())) {
      return NextResponse.json(
        { success: false, message: 'Tài nguyên đang bật chế độ liên hệ Zalo Admin. Vui lòng liên hệ admin để mua.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const resourceId = Number(body.resource_id || 0);
    const quantity = Number(body.quantity || 1);

    if (!resourceId) {
      return NextResponse.json({ success: false, message: 'Thiếu resource ID' }, { status: 400 });
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
