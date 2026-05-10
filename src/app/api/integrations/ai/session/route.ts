import { NextResponse } from 'next/server';
import { createIntegratedAiSession } from '@/lib/integrated-service-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await createIntegratedAiSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: true, ...session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tạo phiên AI';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
