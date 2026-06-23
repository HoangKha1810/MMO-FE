import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateSmmApiRequest,
  createExternalSmmOrder,
  readExternalSmmRequestBody,
} from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const body = await readExternalSmmRequestBody(req);

  try {
    const auth = await authenticateSmmApiRequest(req, body);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const data = await createExternalSmmOrder(auth.account, {
      ...Object.fromEntries(req.nextUrl.searchParams.entries()),
      ...body,
    });
    return NextResponse.json(data, { status: data.success ? 200 : 200 });
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 500;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tạo đơn SMM' },
      { status }
    );
  }
}
