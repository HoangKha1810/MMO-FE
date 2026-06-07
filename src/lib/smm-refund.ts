import { db } from '@/lib/db';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { normalizeSmmOrderStatus } from '@/lib/smm-status';
import { toNumber } from '@/lib/utils';

export function shouldFullRefundSmmStatus(value: unknown) {
  const rawStatus = String(value ?? '').trim().toLowerCase();
  if (!rawStatus || rawStatus === 'partial') {
    return false;
  }

  const normalizedStatus = normalizeSmmOrderStatus(value, '');
  return normalizedStatus === 'Canceled' || normalizedStatus === 'Refunded';
}

function canRefundFromCurrentStatus(value: unknown) {
  const normalizedStatus = normalizeSmmOrderStatus(value, '');
  return normalizedStatus !== 'Completed';
}

function buildStatusPatch(status: string, reason: string) {
  return reason ? { status, reason } : { status };
}

function optionalProviderNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = toNumber(value, Number.NaN);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : null;
}

export async function applySmmProviderStatusToOrder(
  orderId: number,
  payload: Record<string, unknown>,
  options: {
    fallbackStatus?: unknown;
    source?: string;
  } = {}
) {
  const triggerStatus = payload.status ?? payload.state ?? options.fallbackStatus;
  const nextStatus = normalizeSmmOrderStatus(triggerStatus);
  const startCount = optionalProviderNumber(payload.start_count ?? payload.start ?? payload.startCount);
  const remains = optionalProviderNumber(payload.remains ?? payload.remain ?? payload.remaining);
  const reason = String(payload.error || payload.reason || '').trim();

  await db.$executeRawUnsafe(
    `
      UPDATE smm_orders
      SET
        status = ?,
        start_count = COALESCE(?, start_count),
        remains = COALESCE(?, remains),
        reason = CASE WHEN ? <> '' THEN ? ELSE reason END,
        updated_at = NOW()
      WHERE id = ?
    `,
    nextStatus,
    startCount,
    remains,
    reason,
    reason,
    orderId
  );

  return {
    status: nextStatus,
    start_count: startCount,
    remains,
    refunded: false,
    refund_amount: 0,
  };
}

export async function refundCanceledSmmOrder(
  orderId: number,
  options: {
    nextStatus?: unknown;
    triggerStatus?: unknown;
    reason?: string;
    source?: string;
  } = {}
) {
  const normalizedStatus = normalizeSmmOrderStatus(options.nextStatus || options.triggerStatus || 'Canceled');
  const triggerStatus = options.triggerStatus ?? options.nextStatus ?? normalizedStatus;

  if (!shouldFullRefundSmmStatus(triggerStatus)) {
    return { refunded: false, amount: 0, skipped: 'status_not_refundable', order: null };
  }

  const settings = await getLegacySettingsMap();
  const vatPercent = getVatPercent(settings);
  const source = String(options.source || 'smm_status_sync').trim() || 'smm_status_sync';

  return db.$transaction(async (tx) => {
    const order = await tx.smm_orders.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new Error('Không tìm thấy đơn SMM');
    }

    const reason = String(options.reason || '').trim();
    const currentStatus = normalizeSmmOrderStatus(order.status, '');

    if (!canRefundFromCurrentStatus(currentStatus)) {
      const updatedOrder = await tx.smm_orders.update({
        where: { id: orderId },
        data: buildStatusPatch(normalizedStatus, reason),
      });
      return { refunded: false, amount: 0, skipped: 'final_status', order: updatedOrder };
    }

    const alreadyRefunded =
      Boolean(order.is_refunded) ||
      toNumber(order.refund_amount, 0) > 0;

    if (alreadyRefunded) {
      const updatedOrder = await tx.smm_orders.update({
        where: { id: orderId },
        data: buildStatusPatch(normalizedStatus, reason || order.reason || `SMM ${source}`),
      });
      return { refunded: false, amount: 0, skipped: 'already_refunded', order: updatedOrder };
    }

    const subtotal = Math.max(0, toNumber(order.price, 0));
    const refundAmount = Math.round(subtotal + (subtotal * vatPercent) / 100);

    if (refundAmount <= 0) {
      const updatedOrder = await tx.smm_orders.update({
        where: { id: orderId },
        data: buildStatusPatch(normalizedStatus, reason || order.reason || `SMM ${source}`),
      });
      return { refunded: false, amount: 0, skipped: 'empty_amount', order: updatedOrder };
    }

    const locked = await tx.smm_orders.updateMany({
      where: {
        id: orderId,
        OR: [{ is_refunded: false }, { is_refunded: null }],
        AND: [
          {
            OR: [
              { refund_amount: null },
              { refund_amount: { lte: 0 } },
            ],
          },
        ],
      },
      data: {
        status: normalizedStatus,
        reason: reason || order.reason || `Canceled & refunded by ${source}`,
        is_refunded: true,
        refund_amount: refundAmount,
      },
    });

    if (locked.count === 0) {
      const updatedOrder = await tx.smm_orders.findUnique({ where: { id: orderId } });
      return { refunded: false, amount: 0, skipped: 'refund_lock_failed', order: updatedOrder };
    }

    const updatedUser = await tx.users.update({
      where: { id: order.user_id },
      data: {
        balance: { increment: refundAmount },
        last_activity: new Date(),
      },
      select: { balance: true },
    });
    const nextBalance = toNumber(updatedUser.balance, 0);

    await tx.transactions.create({
      data: {
        user_id: order.user_id,
        amount: refundAmount,
        balance_after: nextBalance,
        type: 'refund',
        status: 'success',
        content: `Hoàn tiền đơn SMM #${orderId} do provider trả trạng thái ${normalizedStatus}`,
      },
    }).catch(() => undefined);

    await tx.activity_logs.create({
      data: {
        user_id: order.user_id,
        activity: `Hoàn tiền đơn SMM #${orderId}: +${refundAmount}`,
        user_agent: source,
      },
    }).catch(() => undefined);

    const updatedOrder = await tx.smm_orders.findUnique({ where: { id: orderId } });
    return { refunded: true, amount: refundAmount, skipped: '', order: updatedOrder };
  });
}
