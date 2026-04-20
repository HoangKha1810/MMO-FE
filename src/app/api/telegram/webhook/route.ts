import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!token || !chatId) return null;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  return response.json().catch(() => ({}));
}

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const incomingSecret =
    req.headers.get('x-telegram-bot-api-secret-token') ||
    req.nextUrl.searchParams.get('secret') ||
    '';

  if (configuredSecret && incomingSecret !== configuredSecret) {
    return NextResponse.json({ success: false, message: 'Invalid webhook secret' }, { status: 401 });
  }

  const update = await req.json().catch(() => ({}));
  const message = (update.message || update.edited_message || {}) as Record<string, unknown>;
  const chat = (message.chat || {}) as Record<string, unknown>;
  const from = (message.from || {}) as Record<string, unknown>;
  const text = String(message.text || '').trim();
  const chatId = String(chat.id || '').trim();
  const username = String(from.username || from.first_name || chatId || 'telegram');

  await db.activity_logs.create({
    data: {
      activity: `Telegram webhook ${username}: ${text || JSON.stringify(update).slice(0, 300)}`,
      user_agent: 'telegram-webhook',
    },
  }).catch(() => undefined);

  if (text === '/check' || text === '/start') {
    await sendTelegramMessage(chatId, 'TRUNGTAMMMO webhook đã nhận tín hiệu. Bot đang online.');
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Telegram webhook endpoint is ready. Use POST from Telegram.',
  });
}
