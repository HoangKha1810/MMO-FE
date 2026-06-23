import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAutoMxhApiRequest,
  createExternalAutoMxhOrder,
  readExternalAutoMxhRequestBody,
} from '@/lib/automxh-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const body = await readExternalAutoMxhRequestBody(req);

  try {
    const auth = await authenticateAutoMxhApiRequest(req, body);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json(await createExternalAutoMxhOrder(auth.account, {
      ...Object.fromEntries(req.nextUrl.searchParams.entries()),
      ...body,
    }));
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tạo đơn Auto MXH' },
      { status }
    );
  }
}
