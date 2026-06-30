import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { searchForum } from '@/lib/legacy-modules';

export async function GET(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const keyword = String(req.nextUrl.searchParams.get('q') || '');
    const data = await searchForum(keyword);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không tìm kiếm được forum' },
      { status: 500 }
    );
  }
}
