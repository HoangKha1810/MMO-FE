import { NextRequest, NextResponse } from 'next/server';
import { processSePayDepositByCode } from '@/lib/deposit-processing';
import { logSePayDiagnostic, summarizeSePayPayload } from '@/lib/sepay-debug';
import { verifySePayIpn } from '@/lib/sepay';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

async function runSePayWebhookProcessing(input: {
  ip: string;
  payload: Record<string, unknown>;
  code: string;
  amount: number;
  kind: 'generic' | 'order_paid';
  orderStatus?: string;
  transactionStatus?: string;
}) {
  const payloadSummary = summarizeSePayPayload(input.payload);

  try {
    const result = await processSePayDepositByCode(input.code, input.amount);
    await logSePayDiagnostic({
      channel: 'ipn',
      level: result.state === 'processed' || result.state === 'already_processed' ? 'info' : 'warn',
      message: input.kind === 'generic'
        ? 'Processed generic SePay webhook'
        : 'Processed ORDER_PAID SePay webhook',
      details: {
        ip: input.ip,
        code: input.code,
        amount: input.amount,
        orderStatus: input.orderStatus || null,
        transactionStatus: input.transactionStatus || null,
        state: result.state,
        payload: payloadSummary,
      },
    });

    return result;
  } catch (error) {
    console.error('SePay IPN processing error:', error);
    await logSePayDiagnostic({
      channel: 'ipn',
      level: 'error',
      message: input.kind === 'generic'
        ? 'Generic SePay webhook processing failed'
        : 'ORDER_PAID SePay webhook processing failed',
      details: {
        ip: input.ip,
        code: input.code,
        amount: input.amount,
        orderStatus: input.orderStatus || null,
        transactionStatus: input.transactionStatus || null,
        error: error instanceof Error ? error.message : 'unknown',
        payload: payloadSummary,
      },
    });
    throw error;
  }
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  const ip = extractIp(req);

  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    await logSePayDiagnostic({
      channel: 'ipn',
      level: 'error',
      message: 'Received invalid JSON payload',
      details: { ip },
    });
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 });
  }

  const verified = verifySePayIpn(req.headers, payload);
  if (!verified.success) {
    await logSePayDiagnostic({
      channel: 'ipn',
      level: 'error',
      message: 'Authorization failed',
      details: {
        ip,
        reason: verified.message,
        payload: summarizeSePayPayload(payload),
      },
    });
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
      const result = await runSePayWebhookProcessing({
        ip,
        payload,
        code: genericCode,
        amount: genericAmount,
        kind: 'generic',
      });

      return NextResponse.json({
        success: true,
        ip_address: ip,
        data: result,
      });
    } catch {
      return NextResponse.json({ success: false, message: 'Failed to process SePay webhook' }, { status: 500 });
    }
  }

  if (payload.notification_type !== 'ORDER_PAID') {
    await logSePayDiagnostic({
      channel: 'ipn',
      level: 'warn',
      message: 'Ignored non ORDER_PAID notification',
      details: {
        ip,
        notification_type: payload.notification_type ?? null,
        payload: summarizeSePayPayload(payload),
      },
    });
    return NextResponse.json({ success: true, message: 'Ignored notification type' });
  }

  const order = (payload.order || {}) as Record<string, unknown>;
  const transaction = (payload.transaction || {}) as Record<string, unknown>;
  const transactionCode = String(order.order_invoice_number || '').trim();
  const orderStatus = String(order.order_status || '').trim().toUpperCase();
  const transactionStatus = String(transaction.transaction_status || '').trim().toUpperCase();

  if (!transactionCode || (transactionStatus !== 'APPROVED' && orderStatus !== 'CAPTURED')) {
    await logSePayDiagnostic({
      channel: 'ipn',
      level: 'warn',
      message: 'Ignored ORDER_PAID because status was not finalized',
      details: {
        ip,
        transactionCode,
        orderStatus,
        transactionStatus,
        payload: summarizeSePayPayload(payload),
      },
    });
    return NextResponse.json({ success: true, message: 'Ignored payment status' });
  }

  try {
    const result = await runSePayWebhookProcessing({
      ip,
      payload,
      code: transactionCode,
      amount: toNumber(transaction.transaction_amount, 0),
      kind: 'order_paid',
      orderStatus,
      transactionStatus,
    });

    return NextResponse.json({
      success: true,
      ip_address: ip,
      data: result,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to process IPN' }, { status: 500 });
  }
}
