import { NextRequest, NextResponse } from 'next/server';
import { authenticateAutoMxhApiRequest, getExternalAutoMxhProfile } from '@/lib/automxh-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateAutoMxhApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json(await getExternalAutoMxhProfile(auth.account));
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể lấy profile Auto MXH' },
      { status: 500 }
    );
  }
}
