import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const token = process.env.TELEGRAM_BOT_TOKEN || String(body.token || '');
  const chatId = process.env.TELEGRAM_CHAT_ID || String(body.chat_id || '');
  const text = String(body.text || `TRUNGTAMMMO test từ admin #${auth.user?.id}`);

  if (!token || !chatId) {
    return NextResponse.json({ success: false, message: 'Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID' }, { status: 400 });
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const payload = await response.json().catch(() => ({}));

  return NextResponse.json({ success: response.ok, data: payload }, { status: response.ok ? 200 : 502 });
}
