import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';

function getTelegramToken(req: NextRequest, body: Record<string, unknown> = {}) {
  return String(body.token || req.nextUrl.searchParams.get('token') || process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

async function telegramGet(token: string, method: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  const token = getTelegramToken(req);
  if (!token) {
    return NextResponse.json({ success: false, message: 'Thiếu TELEGRAM_BOT_TOKEN' }, { status: 400 });
  }

  const [me, webhook] = await Promise.all([
    telegramGet(token, 'getMe'),
    telegramGet(token, 'getWebhookInfo'),
  ]);

  return NextResponse.json({
    success: me.ok && webhook.ok,
    data: {
      bot: me.payload,
      webhook: webhook.payload,
    },
  }, { status: me.ok && webhook.ok ? 200 : 502 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const token = getTelegramToken(req, body);
  const chatId = String(body.chat_id || process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!token) {
    return NextResponse.json({ success: false, message: 'Thiếu TELEGRAM_BOT_TOKEN' }, { status: 400 });
  }

  const [me, webhook] = await Promise.all([
    telegramGet(token, 'getMe'),
    telegramGet(token, 'getWebhookInfo'),
  ]);

  let testMessage: unknown = null;
  if (chatId) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `TRUNGTAMMMO Telegram check OK #${auth.user?.id || 'admin'}`,
      }),
    });
    testMessage = await response.json().catch(() => ({}));
  }

  return NextResponse.json({
    success: me.ok && webhook.ok,
    data: {
      bot: me.payload,
      webhook: webhook.payload,
      test_message: testMessage,
    },
  }, { status: me.ok && webhook.ok ? 200 : 502 });
}
