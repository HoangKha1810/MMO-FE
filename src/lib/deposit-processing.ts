import 'server-only';

import { db } from '@/lib/db';
import { extractSePayReferenceCodes } from '@/lib/sepay-codes';
import { toNumber } from '@/lib/utils';

async function processDepositByCodeInternal(code: string, amount: number | undefined, sourceLabel: string) {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw new Error('Thiếu mã giao dịch');
  }

  return db.$transaction(async (tx) => {
    const deposits = await tx.transactions.findMany({
      where: {
        type: 'deposit',
        OR: [
          { content: normalizedCode },
          { content: { contains: normalizedCode } },
        ],
      },
      orderBy: { id: 'desc' },
      select: { id: true, user_id: true, amount: true, status: true, content: true },
      take: 5,
    });

    const deposit = deposits.find((row) => {
      const codes = extractSePayReferenceCodes(row.content);
      return codes.includes(normalizedCode);
    }) || deposits[0];

    if (!deposit) return { state: 'missing' as const };
    if (deposit.status === 'success') return { state: 'already_processed' as const, id: deposit.id };

    const user = await tx.users.findUnique({
      where: { id: deposit.user_id },
      select: { id: true, balance: true },
    });
    if (!user) return { state: 'user_missing' as const, id: deposit.id };

    const paidAmount = amount && amount > 0 ? amount : toNumber(deposit.amount, 0);
    const nextBalance = toNumber(user.balance, 0) + paidAmount;

    await tx.users.update({
      where: { id: user.id },
      data: { balance: nextBalance, last_activity: new Date() },
    });
    await tx.transactions.update({
      where: { id: deposit.id },
      data: { status: 'success', balance_after: nextBalance },
    });
    await tx.activity_logs.create({
      data: {
        user_id: user.id,
        activity: `Nạp tiền ${sourceLabel} thành công: ${normalizedCode}`,
      },
    }).catch(() => undefined);

    return { state: 'processed' as const, id: deposit.id, userId: user.id, balance: nextBalance };
  });
}

export async function processBankDepositByCode(code: string, amount?: number) {
  return processDepositByCodeInternal(code, amount, 'bank/MoMo');
}

export async function processSePayDepositByCode(code: string, amount?: number) {
  return processDepositByCodeInternal(code, amount, 'SePay');
}
