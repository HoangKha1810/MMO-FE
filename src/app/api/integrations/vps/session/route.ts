import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: 'VPS đã tách tài khoản riêng. Vui lòng đăng nhập trực tiếp trong cổng VPS.',
    },
    { status: 410 },
  );
}
