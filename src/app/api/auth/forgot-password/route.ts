import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim();

  if (!email) {
    return NextResponse.json({ success: false, message: 'Vui lòng nhập email hợp lệ' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi.',
  });
}
