import 'server-only';

import { db } from '@/lib/db';
import {
  buildSePayReferenceContent,
  extractSePayPaymentReferenceCodes,
  extractSePayReferenceCodes,
  getPrimarySePayReferenceCode,
} from '@/lib/sepay-codes';
import { toNumber } from '@/lib/utils';

function resolveDepositWallet(deposit: {
  wallet_type?: string | null;
  content: string | null | undefined;
}, code = '') {
  const normalizedWallet = String(deposit.wallet_type || '').trim().toLowerCase();
  if (normalizedWallet === 'game') return 'game' as const;

  const normalizedCode = code.trim().toUpperCase();
  const normalizedContent = String(deposit.content || '').toUpperCase();
  if (normalizedCode.startsWith('GAMESEP') || normalizedContent.includes('WALLET:GAME') || normalizedContent.startsWith('GAMESEP')) {
    return 'game' as const;
  }

  return 'main' as const;
}

function preserveDepositReferenceContent(content: string | null | undefined, fallbackCode: string) {
  const primaryCode = getPrimarySePayReferenceCode(content) || fallbackCode;
  return buildSePayReferenceContent([
    primaryCode,
    content,
  ]) || primaryCode;
}

function contentHasExactReference(content: string | null | undefined, normalizedUpperCode: string) {
  const raw = String(content || '').trim();
  if (!raw) {
    return false;
  }

  if (raw.toUpperCase() === normalizedUpperCode) {
    return true;
  }

  return [
    ...extractSePayPaymentReferenceCodes(raw),
    ...extractSePayReferenceCodes(raw),
  ].some((rowCode) => rowCode.toUpperCase() === normalizedUpperCode);
}

async function processDepositByCodeInternal(code: string, amount: number | undefined, sourceLabel: string) {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw new Error('Thiếu mã giao dịch');
  }
  const normalizedUpperCode = normalizedCode.toUpperCase();

  const result = await db.$transaction(async (tx) => {
    const deposits = await tx.transactions.findMany({
      where: {
        type: 'deposit',
        OR: [
          { content: normalizedCode },
          { content: { contains: normalizedCode } },
        ],
      },
      orderBy: { id: 'desc' },
      select: { id: true, user_id: true, amount: true, status: true, content: true, wallet_type: true },
      take: 5,
    });

    const deposit = deposits.find((row) => contentHasExactReference(row.content, normalizedUpperCode));

    if (!deposit) return { state: 'missing' as const };
    if (deposit.status === 'success') return { state: 'already_processed' as const, id: deposit.id };
    if (deposit.status === 'failed') return { state: 'failed' as const, id: deposit.id };

    const expectedAmount = Math.trunc(toNumber(deposit.amount, 0));
    const paidAmount = Math.trunc(toNumber(amount, 0));
    if (!paidAmount || paidAmount !== expectedAmount) {
      return { state: 'amount_mismatch' as const, id: deposit.id };
    }

    const claimed = await tx.transactions.updateMany({
      where: {
        id: deposit.id,
        status: { notIn: ['success', 'failed'] },
      },
      data: { status: 'processing' },
    });

    if (claimed.count === 0) {
      return { state: 'already_processed' as const, id: deposit.id };
    }

    const wallet = resolveDepositWallet(deposit, normalizedCode);
    const user = await tx.users.findUnique({
      where: { id: deposit.user_id },
      select: { id: true, balance: true, game_balance: true },
    });
    if (!user) return { state: 'user_missing' as const, id: deposit.id };

    const currentBalance = wallet === 'game' ? toNumber(user.game_balance, 0) : toNumber(user.balance, 0);
    const nextBalance = currentBalance + paidAmount;

    await tx.users.update({
      where: { id: user.id },
      data: wallet === 'game'
        ? { game_balance: nextBalance, last_activity: new Date() }
        : { balance: nextBalance, last_activity: new Date() },
    });
    await tx.transactions.update({
      where: { id: deposit.id },
      data: {
        status: 'success',
        balance_after: nextBalance,
        wallet_type: wallet,
        content: preserveDepositReferenceContent(deposit.content, normalizedCode),
      },
    });

    return { state: 'processed' as const, id: deposit.id, userId: user.id, balance: nextBalance, wallet };
  }, { maxWait: 15000, timeout: 15000 });

  if (result.state === 'processed') {
    await db.activity_logs.create({
      data: {
        user_id: result.userId,
        activity: `Nạp tiền ${sourceLabel} thành công vào ${result.wallet === 'game' ? 'ví game' : 'ví chính'}: ${normalizedCode}`,
      },
    }).catch(() => undefined);
  }

  return result;
}

export async function approveDepositById(id: number, sourceLabel = 'admin') {
  if (!id) {
    throw new Error('Thiếu ID giao dịch');
  }

  const result = await db.$transaction(async (tx) => {
    const deposit = await tx.transactions.findUnique({
      where: { id },
      select: { id: true, user_id: true, amount: true, status: true, content: true, wallet_type: true },
    });
    if (!deposit) return { state: 'missing' as const };
    if (deposit.status === 'success') return { state: 'already_processed' as const, id: deposit.id };
    if (deposit.status === 'failed') return { state: 'failed' as const, id: deposit.id };

    const claimed = await tx.transactions.updateMany({
      where: {
        id: deposit.id,
        status: { notIn: ['success', 'failed'] },
      },
      data: { status: 'processing' },
    });

    if (claimed.count === 0) {
      return { state: 'already_processed' as const, id: deposit.id };
    }

    const code = getPrimarySePayReferenceCode(deposit.content) || `TX-${id}`;
    const wallet = resolveDepositWallet(deposit, code);
    const user = await tx.users.findUnique({
      where: { id: deposit.user_id },
      select: { id: true, balance: true, game_balance: true },
    });
    if (!user) return { state: 'user_missing' as const, id: deposit.id };

    const paidAmount = toNumber(deposit.amount, 0);
    const currentBalance = wallet === 'game' ? toNumber(user.game_balance, 0) : toNumber(user.balance, 0);
    const nextBalance = currentBalance + paidAmount;

    await tx.users.update({
      where: { id: user.id },
      data: wallet === 'game'
        ? { game_balance: nextBalance, last_activity: new Date() }
        : { balance: nextBalance, last_activity: new Date() },
    });
    await tx.transactions.update({
      where: { id: deposit.id },
      data: {
        status: 'success',
        balance_after: nextBalance,
        wallet_type: wallet,
        content: preserveDepositReferenceContent(deposit.content, `TX-${id}`),
      },
    });

    return { state: 'processed' as const, id: deposit.id, userId: user.id, balance: nextBalance, wallet, code };
  }, { maxWait: 15000, timeout: 15000 });

  if (result.state === 'processed') {
    await db.activity_logs.create({
      data: {
        user_id: result.userId,
        activity: `Nạp tiền ${sourceLabel} thành công vào ${result.wallet === 'game' ? 'ví game' : 'ví chính'}: ${result.code}`,
      },
    }).catch(() => undefined);
  }

  return result;
}

export async function processBankDepositByCode(code: string, amount?: number) {
  return processDepositByCodeInternal(code, amount, 'bank/MoMo');
}

export async function processSePayDepositByCode(code: string, amount?: number) {
  return processDepositByCodeInternal(code, amount, 'SePay');
}
