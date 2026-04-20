import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDownloadableResourceOrder } from '@/lib/resource-actions';

export async function GET(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orderId } = await params;
    const data = await getDownloadableResourceOrder(userId, Number(orderId));

    if (data.type === 'redirect') {
      return NextResponse.redirect(data.url);
    }

    return new NextResponse(data.content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(data.filename)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải tài nguyên' },
      { status: 400 }
    );
  }
}
