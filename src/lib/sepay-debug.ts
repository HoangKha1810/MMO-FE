import 'server-only';

import { db } from '@/lib/db';

function clampText(value: string, max = 1200) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function summarizeSePayPayload(payload: Record<string, unknown>) {
  const summary = {
    notification_type: payload.notification_type ?? null,
    id: payload.id ?? null,
    gateway: payload.gateway ?? null,
    transactionDate: payload.transactionDate ?? payload.transaction_date ?? null,
    transferType: payload.transferType ?? payload.transfer_type ?? null,
    transferAmount: payload.transferAmount ?? payload.transfer_amount ?? payload.amount ?? null,
    code: payload.code ?? payload.order_code ?? payload.order_invoice_number ?? null,
    referenceCode: payload.referenceCode ?? payload.reference_number ?? null,
    accountNumber: payload.accountNumber ?? payload.account_number ?? null,
    content: payload.content ?? payload.transaction_content ?? null,
    description: payload.description ?? null,
    order: typeof payload.order === 'object' && payload.order ? payload.order : null,
    transaction: typeof payload.transaction === 'object' && payload.transaction ? payload.transaction : null,
  };

  return clampText(JSON.stringify(summary));
}

export async function logSePayDiagnostic(input: {
  channel: 'ipn' | 'sync' | 'checkout';
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
  userId?: number | null;
}) {
  const suffix = input.details ? ` | ${clampText(JSON.stringify(input.details))}` : '';
  const activity = `[sepay:${input.channel}:${input.level}] ${input.message}${suffix}`;

  await db.activity_logs.create({
    data: {
      user_id: input.userId ?? undefined,
      activity,
      user_agent: `sepay-${input.channel}`,
    },
  }).catch(() => undefined);
}
