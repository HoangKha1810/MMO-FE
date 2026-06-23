import { NextRequest, NextResponse } from 'next/server';
import { authenticateSmmApiRequest, getExternalSmmQuote } from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateSmmApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const data = await getExternalSmmQuote(Object.fromEntries(req.nextUrl.searchParams.entries()));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tính giá đơn SMM' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  try {
    const auth = await authenticateSmmApiRequest(req, body);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const data = await getExternalSmmQuote(body);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tính giá đơn SMM' },
      { status: 400 }
    );
  }
}
