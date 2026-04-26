import 'server-only';

import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { processSePayDepositByCode } from '@/lib/legacy-modules';
import { getSePayConfig } from '@/lib/sepay';
import { toNumber } from '@/lib/utils';

interface PendingDepositRow {
  id: number;
  user_id: number;
  amount: unknown;
  content: string | null;
  created_at: Date;
}

interface SePayTransactionRow {
  id?: string | number;
  transaction_date?: string;
  account_number?: string | null;
  sub_account?: string | null;
  amount_in?: string | number;
  amount_out?: string | number;
  accumulated?: string | number;
  code?: string | null;
  transaction_content?: string | null;
  content?: string | null;
  description?: string | null;
  reference_number?: string | null;
  referenceCode?: string | null;
  bank_account_id?: string | number | null;
}

interface ReconcilePendingSePayDepositsInput {
  limit?: number;
  userId?: number;
}

function buildSePayApiAuthHeader() {
  const config = getSePayConfig();
  if (!config.apiKey || !config.userApiUrl) {
    return null;
  }

  return {
    config,
    authorization: `Apikey ${config.apiKey}`,
  };
}

function formatSePayDateTime(value: Date) {
  return serializeDatabaseDateTime(value);
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function normalizeText(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function matchesInvoiceNumber(row: SePayTransactionRow, invoiceNumber: string) {
  const normalizedInvoice = normalizeText(invoiceNumber);
  if (!normalizedInvoice) return false;

  const candidates = [
    row.code,
    row.transaction_content,
    row.content,
    row.description,
    row.reference_number,
    row.referenceCode,
    row.sub_account,
  ].map(normalizeText);

  return candidates.some((candidate) => candidate.includes(normalizedInvoice));
}

async function findSePayTransactionByInvoiceNumber(input: {
  invoiceNumber: string;
  amount: number;
  createdAt: Date;
}) {
  const auth = buildSePayApiAuthHeader();
  if (!auth) {
    return { transaction: null, skipped: 'missing_api_key' as const };
  }

  const url = new URL(`${auth.config.userApiUrl}/transactions/list`);
  url.searchParams.set('limit', '200');
  url.searchParams.set('amount_in', String(Math.trunc(input.amount)));
  url.searchParams.set('transaction_date_min', formatSePayDateTime(addHours(input.createdAt, -24)));
  url.searchParams.set('transaction_date_max', formatSePayDateTime(addHours(new Date(), 2)));

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: auth.authorization,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`SePay transaction lookup failed with HTTP ${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  const rows = Array.isArray(payload.transactions)
    ? payload.transactions as SePayTransactionRow[]
    : [];

  const exactMatch = rows.find((row) => (
    toNumber(row.amount_in, 0) === Math.trunc(input.amount) &&
    matchesInvoiceNumber(row, input.invoiceNumber)
  ));

  return {
    transaction: exactMatch || null,
    skipped: null,
  };
}

export async function reconcilePendingSePayDeposits(input: ReconcilePendingSePayDepositsInput = {}) {
  const auth = buildSePayApiAuthHeader();
  if (!auth) {
    return {
      checked: 0,
      processed: 0,
      already_processed: 0,
      failed: 0,
      still_pending: 0,
      missing_remote: 0,
      skipped: true,
      reason: 'missing_api_key',
      errors: [] as string[],
    };
  }

  const pendingDeposits = await db.transactions.findMany({
    where: {
      type: 'deposit',
      status: 'pending',
      content: { startsWith: 'SEP' },
      ...(input.userId ? { user_id: input.userId } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: Math.max(1, Math.min(input.limit || 20, 100)),
    select: {
      id: true,
      user_id: true,
      amount: true,
      content: true,
      created_at: true,
    },
  });

  let processed = 0;
  let alreadyProcessed = 0;
  let failed = 0;
  let stillPending = 0;
  let missingRemote = 0;
  const errors: string[] = [];

  for (const deposit of pendingDeposits as PendingDepositRow[]) {
    const invoiceNumber = String(deposit.content || '').trim();
    if (!invoiceNumber) {
      continue;
    }

    try {
      const { transaction } = await findSePayTransactionByInvoiceNumber({
        invoiceNumber,
        amount: toNumber(deposit.amount, 0),
        createdAt: deposit.created_at,
      });

      if (!transaction) {
        missingRemote += 1;
        continue;
      }

      const result = await processSePayDepositByCode(
        invoiceNumber,
        toNumber(deposit.amount, 0)
      );

      if (result.state === 'processed') {
        processed += 1;
      } else if (result.state === 'already_processed') {
        alreadyProcessed += 1;
      } else {
        stillPending += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'reconcile failed';
      if (message.includes('HTTP 401') || message.includes('HTTP 403')) {
        return {
          checked: pendingDeposits.length,
          processed,
          already_processed: alreadyProcessed,
          failed,
          still_pending: stillPending,
          missing_remote: missingRemote,
          skipped: true,
          reason: 'invalid_api_key',
          errors: [message],
        };
      }

      errors.push(`${invoiceNumber}: ${message}`);
    }
  }

  return {
    checked: pendingDeposits.length,
    processed,
    already_processed: alreadyProcessed,
    failed,
    still_pending: stillPending,
    missing_remote: missingRemote,
    skipped: false,
    reason: '',
    errors,
  };
}
