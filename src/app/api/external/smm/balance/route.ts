import { NextRequest, NextResponse } from 'next/server';
import { authenticateSmmApiRequest, getExternalSmmProfile } from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateSmmApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const profile = await getExternalSmmProfile(auth.account);
    return NextResponse.json({
      success: true,
      balance: profile.data.balance,
      currency: 'VND',
      data: profile.data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể lấy số dư SMM' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
