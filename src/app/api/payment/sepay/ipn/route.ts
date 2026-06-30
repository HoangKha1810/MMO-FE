import { NextRequest, NextResponse } from 'next/server';
import { processSePayDepositByCode } from '@/lib/deposit-processing';
import { extractSePayPaymentReferenceCodes } from '@/lib/sepay-codes';
import { logSePayDiagnostic, summarizeSePayPayload } from '@/lib/sepay-debug';
import { verifySePayIpn } from '@/lib/sepay';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function extractIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

function extractSePayCodes(payload: Record<string, unknown>) {
  const order = (payload.order || {}) as Record<string, unknown>;
  const transaction = (payload.transaction || {}) as Record<string, unknown>;
  const unique = new Set<string>();

  [
    order.order_invoice_number,
    payload.order_invoice_number,
    payload.order_code,
    payload.code,
    transaction.reference_number,
    transaction.transaction_content,
    transaction.content,
    payload.content,
    payload.description,
    payload.transferContent,
    payload.transfer_content,
  ].forEach((value) => {
    extractSePayPaymentReferenceCodes(String(value || '')).forEach((code) => {
      unique.add(code);
    });
  });

  return Array.from(unique);
}

async function runSePayWebhookCandidates(input: {
  ip: string;
  payload: Record<string, unknown>;
  codes: string[];
  amount: number;
  kind: 'generic' | 'order_paid';
  orderStatus?: string;
  transactionStatus?: string;
}) {
  let lastResult: Awaited<ReturnType<typeof processSePayDepositByCode>> | null = null;

  for (const code of input.codes) {
    const result = await runSePayWebhookProcessing({
      ...input,
      code,
    });
    lastResult = result;

    if (result.state === 'processed' || result.state === 'already_processed') {
      return result;
    }
  }

  return lastResult || { state: 'missing' as const };
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

  const genericCodes = extractSePayCodes(payload);
  const transferType = String(payload.transferType || payload.transfer_type || '').trim().toLowerCase();
  const genericAmount = toNumber(
    payload.transferAmount ?? payload.transfer_amount ?? payload.amount,
    0
  );

  if (genericCodes.length > 0 && genericAmount <= 0) {
    await logSePayDiagnostic({
      channel: 'ipn',
      level: 'warn',
      message: 'Ignored SePay webhook because amount_in was missing or zero',
      details: {
        ip,
        codes: genericCodes,
        payload: summarizeSePayPayload(payload),
      },
    });
    return NextResponse.json({ success: true, message: 'Ignored missing amount' });
  }

  const notificationType = String(payload.notification_type || '').trim();

  if (notificationType !== 'ORDER_PAID' && genericCodes.length > 0 && (!transferType || transferType === 'in')) {
    try {
      const result = await runSePayWebhookCandidates({
        ip,
        payload,
        codes: genericCodes,
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

  if (notificationType !== 'ORDER_PAID') {
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
  const orderCodes = extractSePayCodes(payload);
  const orderStatus = String(order.order_status || '').trim().toUpperCase();
  const transactionStatus = String(transaction.transaction_status || '').trim().toUpperCase();

  if (orderCodes.length === 0 || (transactionStatus !== 'APPROVED' && orderStatus !== 'CAPTURED')) {
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
    const result = await runSePayWebhookCandidates({
      ip,
      payload,
      codes: orderCodes,
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
