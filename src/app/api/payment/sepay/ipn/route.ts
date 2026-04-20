import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySePayIpn } from '@/lib/sepay';
import { toNumber } from '@/lib/utils';

function extractIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;

  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 });
  }

  const verified = verifySePayIpn(req.headers, payload);
  if (!verified.success) {
    return NextResponse.json({ success: false, message: verified.message }, { status: 401 });
  }

  if (payload.notification_type !== 'ORDER_PAID') {
    return NextResponse.json({ success: true, message: 'Ignored notification type' });
  }

  const order = (payload.order || {}) as Record<string, unknown>;
  const transaction = (payload.transaction || {}) as Record<string, unknown>;
  const transactionCode = String(order.order_invoice_number || '').trim();
  const transactionStatus = String(transaction.transaction_status || '').trim().toUpperCase();

  if (!transactionCode || transactionStatus !== 'APPROVED') {
    return NextResponse.json({ success: true, message: 'Ignored payment status' });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const deposit = await tx.transactions.findFirst({
        where: {
          type: 'deposit',
          content: transactionCode,
        },
        orderBy: { id: 'desc' },
        select: {
          id: true,
          user_id: true,
          amount: true,
          status: true,
        },
      });

      if (!deposit) {
        return { state: 'missing' as const };
      }

      if (deposit.status === 'success') {
        return { state: 'already_processed' as const };
      }

      const user = await tx.users.findUnique({
        where: { id: deposit.user_id },
        select: {
          id: true,
          username: true,
          balance: true,
        },
      });

      if (!user) {
        return { state: 'user_missing' as const };
      }

      const depositAmount = toNumber(deposit.amount, toNumber(transaction.transaction_amount, 0));
      const newBalance = toNumber(user.balance, 0) + depositAmount;

      await tx.users.update({
        where: { id: user.id },
        data: {
          balance: newBalance,
          last_activity: new Date(),
        },
      });

      await tx.transactions.update({
        where: { id: deposit.id },
        data: {
          status: 'success',
          balance_after: newBalance,
        },
      });

      await tx.activity_logs.create({
        data: {
          user_id: user.id,
          activity: `Nạp tiền SePay thành công: ${transactionCode}`,
          ip_address: extractIp(req),
          user_agent: req.headers.get('user-agent') || 'sepay-ipn',
        },
      });

      return { state: 'processed' as const, userId: user.id, username: user.username, newBalance };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('SePay IPN error:', error);
    return NextResponse.json({ success: false, message: 'Failed to process IPN' }, { status: 500 });
  }
}
