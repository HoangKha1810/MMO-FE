import 'server-only';

import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { getRequestIp, isTrackableIp, logSecurityEvent } from '@/lib/ip-security';
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

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseAllowlist(value: string) {
  return value
    .split(/[,\n;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readDirectDepositSignature(req: NextRequest | undefined, input: Record<string, unknown>) {
  return String(
    req?.headers.get('x-deposit-signature') ||
    req?.headers.get('x-signature') ||
    input.deposit_signature ||
    input.signature ||
    ''
  ).trim();
}

function buildDirectDepositSignature(input: {
  secret: string;
  userId: number;
  amount: number;
  externalRef: string;
}) {
  return crypto
    .createHmac('sha256', input.secret)
    .update(`${input.amount}|${input.externalRef}|${input.userId}`)
    .digest('hex');
}

async function assertDirectExternalDepositAllowed(input: {
  req?: NextRequest;
  payload: Record<string, unknown>;
  userId: number;
  amount: number;
  externalRef: string;
}) {
  const isEnabled = process.env.ENABLE_EXTERNAL_API_DIRECT_DEPOSIT === '1';
  const expectedSecret = String(
    process.env.EXTERNAL_API_DEPOSIT_SECRET ||
    process.env.EXTERNAL_WALLET_DEPOSIT_SECRET ||
    ''
  ).trim();
  const providedSecret = String(
    input.payload.deposit_secret ||
    input.payload.webhook_secret ||
    input.payload.external_deposit_secret ||
    input.payload.secret ||
    ''
  ).trim();
  const ip = input.req ? getRequestIp(input.req) : 'unknown';
  const allowlist = parseAllowlist(
    process.env.EXTERNAL_API_DEPOSIT_ALLOWED_IPS ||
    process.env.EXTERNAL_WALLET_DEPOSIT_ALLOWED_IPS ||
    ''
  );
  const signatureSecret = String(
    process.env.EXTERNAL_API_DEPOSIT_SIGNATURE_SECRET ||
    process.env.EXTERNAL_WALLET_DEPOSIT_SIGNATURE_SECRET ||
    expectedSecret
  ).trim();
  const providedSignature = readDirectDepositSignature(input.req, input.payload);
  const expectedSignature = signatureSecret
    ? buildDirectDepositSignature({
        secret: signatureSecret,
        userId: input.userId,
        amount: input.amount,
        externalRef: input.externalRef,
      })
    : '';
  const signatureOk = Boolean(
    providedSignature &&
    expectedSignature &&
    timingSafeEqualString(providedSignature.toLowerCase(), expectedSignature.toLowerCase())
  );
  const ipOk = allowlist.length === 0 || (isTrackableIp(ip) && allowlist.includes(ip));
  const legacySecretOk = Boolean(expectedSecret && providedSecret && timingSafeEqualString(expectedSecret, providedSecret));

  if (!isEnabled || !ipOk || !signatureOk || !legacySecretOk) {
    await logSecurityEvent({
      eventType: 'EXTERNAL_DIRECT_DEPOSIT_DENIED',
      severity: 'CRITICAL',
      ip,
      userId: input.userId,
      uri: input.req?.nextUrl.pathname,
      method: input.req?.method,
      field: 'direct_deposit',
      payload: JSON.stringify({
        enabled: isEnabled,
        ip_ok: ipOk,
        signature_ok: signatureOk,
        secret_ok: legacySecretOk,
        amount: input.amount,
        external_ref: input.externalRef,
      }),
      userAgent: input.req?.headers.get('user-agent'),
      autoBanned: false,
    }).catch(() => undefined);
    throw externalWalletError(
      'Nạp tiền trực tiếp qua API bị chặn. Vui lòng dùng deposit_checkout/SePay checkout hoặc cấu hình IP allowlist + HMAC signature cho webhook nội bộ.',
      403
    );
  }
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

function resolveCallbackUrl(value: unknown, fallbackOrigin: string, fallbackPath: string) {
  const raw = String(value || '').trim();
  if (raw) {
    try {
      const url = new URL(raw, fallbackOrigin || 'https://trungtammmo.vn');
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.toString();
      }
    } catch {
      // Fall through to origin fallback.
    }
  }

  const origin = String(fallbackOrigin || '').trim();
  if (!origin) return '';

  try {
    const url = new URL(fallbackPath, origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return '';
  }

  return '';
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
  sourceLabel = 'External API',
  req?: NextRequest
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

  await assertDirectExternalDepositAllowed({
    req,
    payload: input,
    userId: account.userId,
    amount,
    externalRef,
  });

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
  const callbackOrigin = String(
    input.callback_origin ||
    input.return_origin ||
    input.origin ||
    ''
  ).trim();
  const successUrl = resolveCallbackUrl(input.success_url, callbackOrigin, '/wallet?payment=success');
  const errorUrl = resolveCallbackUrl(input.error_url, callbackOrigin, '/wallet?payment=error');
  const cancelUrl = resolveCallbackUrl(input.cancel_url, callbackOrigin, '/wallet?payment=cancel');

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
    description: `Nap tien vi ${user.username || `User#${account.userId}`} (UID ${account.userId})`,
    orderId: sourceCode,
    origin,
    successUrl,
    errorUrl,
    cancelUrl,
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
