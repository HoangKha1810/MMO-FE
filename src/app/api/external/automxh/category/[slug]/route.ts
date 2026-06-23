import { NextRequest, NextResponse } from 'next/server';
import { authenticateAutoMxhApiRequest, getExternalAutoMxhCategory } from '@/lib/automxh-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await authenticateAutoMxhApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { slug } = await context.params;
    return NextResponse.json(await getExternalAutoMxhCategory(slug));
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 500;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải nhóm Auto MXH' },
      { status }
    );
  }
}
