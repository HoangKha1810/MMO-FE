import { NextRequest, NextResponse } from 'next/server';
import { processSePayDepositByCode } from '@/lib/legacy-modules';
import { verifySePayIpn } from '@/lib/sepay';
import { toNumber } from '@/lib/utils';

function extractIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

function extractSePayCode(payload: Record<string, unknown>) {
  const directCode = String(
    payload.code ||
    payload.order_code ||
    payload.order_invoice_number ||
    ''
  ).trim();

  if (directCode) {
    return directCode;
  }

  const rawText = [
    payload.content,
    payload.description,
    payload.transferContent,
    payload.transfer_content,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean);

  const matched = rawText?.match(/\bSEP\d+T\d+\b/i);
  return matched ? matched[0] : '';
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

  const genericCode = extractSePayCode(payload);
  const transferType = String(payload.transferType || payload.transfer_type || '').trim().toLowerCase();
  const genericAmount = toNumber(
    payload.transferAmount ?? payload.transfer_amount ?? payload.amount,
    0
  );

  if (genericCode && (!transferType || transferType === 'in')) {
    try {
      const result = await processSePayDepositByCode(genericCode, genericAmount);
      return NextResponse.json({
        success: true,
        ip_address: extractIp(req),
        data: result,
      });
    } catch (error) {
      console.error('SePay generic webhook error:', error);
      return NextResponse.json({ success: false, message: 'Failed to process SePay webhook' }, { status: 500 });
    }
  }

  if (payload.notification_type !== 'ORDER_PAID') {
    return NextResponse.json({ success: true, message: 'Ignored notification type' });
  }

  const order = (payload.order || {}) as Record<string, unknown>;
  const transaction = (payload.transaction || {}) as Record<string, unknown>;
  const transactionCode = String(order.order_invoice_number || '').trim();
  const orderStatus = String(order.order_status || '').trim().toUpperCase();
  const transactionStatus = String(transaction.transaction_status || '').trim().toUpperCase();

  if (!transactionCode || (transactionStatus !== 'APPROVED' && orderStatus !== 'CAPTURED')) {
    return NextResponse.json({ success: true, message: 'Ignored payment status' });
  }

  try {
    const result = await processSePayDepositByCode(
      transactionCode,
      toNumber(transaction.transaction_amount, 0)
    );

    return NextResponse.json({
      success: true,
      ip_address: extractIp(req),
      data: result,
    });
  } catch (error) {
    console.error('SePay IPN error:', error);
    return NextResponse.json({ success: false, message: 'Failed to process IPN' }, { status: 500 });
  }
}
