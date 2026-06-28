import { NextResponse } from 'next/server';
import { listWebServicePackages } from '@/lib/web-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const packages = await listWebServicePackages({ activeOnly: true });
    return NextResponse.json({ success: true, data: packages }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được bảng giá dịch vụ web';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}
