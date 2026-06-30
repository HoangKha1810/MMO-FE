import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { submitResourceReview } from '@/lib/resource-actions';

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
    const rating = Number(body.rating || 5);
    const comment = String(body.comment || '').trim();

    if (!resourceId) {
      return NextResponse.json({ success: false, message: 'Thiếu resource ID' }, { status: 400 });
    }

    const data = await submitResourceReview(userId, resourceId, rating, comment);
    return NextResponse.json({ success: true, message: 'Đã gửi đánh giá', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể gửi đánh giá' },
      { status: 400 }
    );
  }
}
