import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAutoMxhApiRequest,
  getExternalAutoMxhQuote,
  readExternalAutoMxhRequestBody,
} from '@/lib/automxh-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateAutoMxhApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json(await getExternalAutoMxhQuote(Object.fromEntries(req.nextUrl.searchParams.entries())));
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tính giá Auto MXH' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await readExternalAutoMxhRequestBody(req);

  try {
    const auth = await authenticateAutoMxhApiRequest(req, body);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json(await getExternalAutoMxhQuote(body));
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tính giá Auto MXH' },
      { status: 400 }
    );
  }
}
