import 'server-only';

import { db } from '@/lib/db';
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
