import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { searchForum } from '@/lib/legacy-modules';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

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
