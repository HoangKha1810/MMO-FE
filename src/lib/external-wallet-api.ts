import 'server-only';

import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { buildSePayReferenceContent, extractSePayPaymentReferenceCodes } from '@/lib/sepay-codes';
import { createSePayCheckoutSession } from '@/lib/sepay';
import { toNumber } from '@/lib/utils';

type ExternalApiAccount = {
  userId: number;
  username: string;
};

function externalWalletError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function roundVnd(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function normalizeExternalRef(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function normalizeTransactionContentMarker(value: string) {
  return value
    .split('|')
    .map((part) => part.trim())
    .find((part) => /^external_ref=/i.test(part))
    ?.replace(/^external_ref=/i, '')
    .trim() || '';
}

function buildTopupContent(input: {
  sourceLabel: string;
  externalRef: string;
  note: string;
}) {
  const parts = [`Nạp tiền API external (${input.sourceLabel})`];
  if (input.externalRef) {
    parts.push(`external_ref=${input.externalRef}`);
  }
  if (input.note) {
    parts.push(`note=${input.note.slice(0, 240)}`);
  }
  return parts.join(' | ');
}

export async function creditExternalApiBalance(
  account: ExternalApiAccount,
  input: Record<string, unknown>,
  sourceLabel = 'External API'
) {
  const amount = Math.max(0, Math.trunc(toNumber(input.amount || input.value || input.money, 0)));
  const externalRef = normalizeExternalRef(input.external_ref || input.reference || input.ref || input.transaction_id);
  const note = String(input.note || input.content || '').trim();

  if (!amount) {
    throw externalWalletError('Thiếu amount hoặc amount không hợp lệ');
  }

  if (amount > 1_000_000_000) {
    throw externalWalletError('Số tiền nạp vượt giới hạn 1.000.000.000đ');
  }

  const marker = externalRef ? `external_ref=${externalRef}` : '';

  const result = await db.$transaction(async (tx) => {
    if (marker) {
      const existing = await tx.transactions.findFirst({
        where: {
          user_id: account.userId,
          type: 'deposit',
          status: 'success',
          content: { contains: marker },
        },
        orderBy: { id: 'desc' },
        select: {
          id: true,
          amount: true,
          balance_after: true,
          content: true,
          created_at: true,
        },
      });

      if (existing) {
        return {
          alreadyProcessed: true,
          transactionId: existing.id,
          amount: roundVnd(toNumber(existing.amount, amount)),
          balanceAfter: roundVnd(toNumber(existing.balance_after, 0)),
          externalRef,
        };
      }
    }

    const user = await tx.users.findUnique({
      where: { id: account.userId },
      select: {
        id: true,
        username: true,
        balance: true,
        status: true,
      },
    });

    if (!user) {
      throw externalWalletError('Không tìm thấy tài khoản API', 404);
    }

    if (String(user.status || '').trim().toLowerCase() !== 'active') {
      throw externalWalletError('Tài khoản API hiện không hoạt động', 403);
    }

    const updated = await tx.users.update({
      where: { id: user.id },
      data: {
        balance: { increment: amount },
        last_activity: new Date(),
      },
      select: { balance: true },
    });
    const balanceAfter = roundVnd(toNumber(updated.balance, toNumber(user.balance, 0) + amount));

    const transaction = await tx.transactions.create({
      data: {
        user_id: user.id,
        type: 'deposit',
        amount,
        balance_after: balanceAfter,
        wallet_type: 'main',
        content: buildTopupContent({ sourceLabel, externalRef, note }),
        status: 'success',
      },
      select: {
        id: true,
        created_at: true,
      },
    });

    return {
      alreadyProcessed: false,
      transactionId: transaction.id,
      amount,
      balanceAfter,
      externalRef,
    };
  }, { maxWait: 15000, timeout: 15000 });

  if (!result.alreadyProcessed) {
    await db.activity_logs.create({
      data: {
        user_id: account.userId,
        activity: `Nạp tiền API external thành công: ${amount.toLocaleString('vi-VN')}đ${externalRef ? ` (${externalRef})` : ''}`,
      },
    }).catch(() => undefined);
  }

  return {
    success: true,
    message: result.alreadyProcessed
      ? 'Giao dịch nạp đã được xử lý trước đó'
      : 'Đã nạp tiền vào tài khoản nguồn API key',
    amount: result.amount,
    balance: result.balanceAfter,
    currency: 'VND',
    transaction_id: result.transactionId,
    external_ref: result.externalRef,
    already_processed: result.alreadyProcessed,
    data: {
      user_id: account.userId,
      username: account.username,
      amount: result.amount,
      balance_after: result.balanceAfter,
      transaction_id: result.transactionId,
      external_ref: result.externalRef,
      already_processed: result.alreadyProcessed,
    },
  };
}

export async function createExternalApiSePayDepositCheckout(
  account: ExternalApiAccount,
  input: Record<string, unknown>,
  sourceLabel = 'External API',
  origin?: string
) {
  const amount = Math.max(0, Math.trunc(toNumber(input.amount || input.value || input.money, 0)));
  const externalRef = normalizeExternalRef(input.external_ref || input.reference || input.ref || input.transaction_id);
  const note = String(input.note || input.content || '').trim();

  if (!amount || amount < 10000) {
    throw externalWalletError('Số tiền nạp tối thiểu là 10.000đ');
  }

  if (amount > 1_000_000_000) {
    throw externalWalletError('Số tiền nạp vượt giới hạn 1.000.000.000đ');
  }

  const user = await db.users.findUnique({
    where: { id: account.userId },
    select: {
      id: true,
      username: true,
      status: true,
    },
  });

  if (!user) {
    throw externalWalletError('Không tìm thấy tài khoản API', 404);
  }

  if (String(user.status || '').trim().toLowerCase() !== 'active') {
    throw externalWalletError('Tài khoản API hiện không hoạt động', 403);
  }

  const sourceCode = `SEP${account.userId}T${Date.now()}`;
  const markers = [
    sourceCode,
    externalRef ? `external_ref=${externalRef}` : '',
    note ? `note=${note.slice(0, 180)}` : '',
  ];

  const deposit = await db.transactions.create({
    data: {
      user_id: account.userId,
      type: 'deposit',
      amount,
      balance_after: 0,
      wallet_type: 'main',
      content: buildSePayReferenceContent(markers) || sourceCode,
      status: 'pending',
    },
    select: {
      id: true,
      amount: true,
      content: true,
      status: true,
      created_at: true,
    },
  });

  const checkout = await createSePayCheckoutSession({
    amount,
    customerId: String(account.userId),
    description: `Nap nguon API ${sourceLabel} ${user.username}${externalRef ? ` ${externalRef}` : ''}`.slice(0, 240),
    orderId: sourceCode,
    origin,
    wallet: 'main',
  });

  if (!checkout.success) {
    await db.transactions.update({
      where: { id: deposit.id },
      data: {
        status: 'failed',
        content: buildSePayReferenceContent([
          deposit.content,
          checkout.message ? `error=${checkout.message.slice(0, 180)}` : '',
        ]) || deposit.content,
      },
    }).catch(() => undefined);

    throw externalWalletError(checkout.message, 500);
  }

  const storedContent = buildSePayReferenceContent([
    checkout.sepayOrderId,
    sourceCode,
    externalRef ? `external_ref=${externalRef}` : '',
    note ? `note=${note.slice(0, 180)}` : '',
  ]);

  const updatedDeposit = await db.transactions.update({
    where: { id: deposit.id },
    data: {
      content: storedContent || deposit.content,
      wallet_type: 'main',
    },
    select: {
      id: true,
      amount: true,
      content: true,
      status: true,
      created_at: true,
    },
  });

  return {
    success: true,
    message: 'Đã tạo QR SePay cho tài khoản nguồn API key',
    currency: 'VND',
    amount,
    external_ref: externalRef,
    transaction_id: updatedDeposit.id,
    source_order_id: sourceCode,
    status: updatedDeposit.status,
    data: {
      user_id: account.userId,
      username: account.username,
      transaction_id: updatedDeposit.id,
      amount: toNumber(updatedDeposit.amount, amount),
      status: updatedDeposit.status,
      external_ref: externalRef,
      source_order_id: sourceCode,
      content: updatedDeposit.content,
      created_at: serializeDatabaseDateTime(updatedDeposit.created_at),
    },
    payment: {
      order_id: sourceCode,
      sepay_order_id: checkout.sepayOrderId,
      checkout_url: checkout.checkoutUrl,
      checkout_redirect_url: checkout.redirectUrl,
      fields: checkout.fields,
      ipn_url: checkout.config.ipnUrl,
    },
  };
}

export async function listExternalApiTransactions(
  account: ExternalApiAccount,
  params: URLSearchParams
) {
  const page = Math.max(1, Math.trunc(toNumber(params.get('page'), 1)));
  const perPage = Math.min(100, Math.max(1, Math.trunc(toNumber(params.get('per_page') || params.get('limit'), 30))));
  const type = String(params.get('type') || '').trim();
  const status = String(params.get('status') || '').trim();
  const wallet = String(params.get('wallet') || params.get('wallet_type') || '').trim();
  const externalRef = normalizeExternalRef(
    params.get('external_ref') || params.get('reference') || params.get('ref') || params.get('transaction_id')
  );
  const search = String(params.get('search') || params.get('q') || '').trim();

  const where: Record<string, unknown> = {
    user_id: account.userId,
  };

  if (type) where.type = type;
  if (status) where.status = status;
  if (wallet) where.wallet_type = wallet;

  const contentFilters = [externalRef, search]
    .filter(Boolean)
    .map((value) => ({ content: { contains: value } }));

  if (contentFilters.length === 1) {
    Object.assign(where, contentFilters[0]);
  } else if (contentFilters.length > 1) {
    where.AND = contentFilters;
  }

  const [rows, total] = await Promise.all([
    db.transactions.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        user_id: true,
        type: true,
        amount: true,
        balance_after: true,
        wallet_type: true,
        content: true,
        status: true,
        created_at: true,
      },
    }),
    db.transactions.count({ where }),
  ]);

  return {
    success: true,
    data: rows.map((row) => {
      const content = String(row.content || '');
      return {
        id: row.id,
        transaction_id: row.id,
        user_id: row.user_id,
        type: row.type,
        status: row.status,
        amount: roundVnd(toNumber(row.amount, 0)),
        balance_after: roundVnd(toNumber(row.balance_after, 0)),
        wallet_type: row.wallet_type || 'main',
        content,
        external_ref: normalizeTransactionContentMarker(content),
        payment_refs: extractSePayPaymentReferenceCodes(content),
        created_at: serializeDatabaseDateTime(row.created_at),
      };
    }),
    pagination: {
      current_page: page,
      per_page: perPage,
      total_items: total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}
