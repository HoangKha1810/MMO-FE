import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { db } from '@/lib/db';
import { tableExists } from '@/lib/legacy-modules';
import {
  buyTheCaoSieuTocCard,
  getTheCaoSieuTocCardConfig,
  getTheCaoSieuTocStatusCode,
  normalizeTheCaoSieuTocTelco,
  settleTheCaoSieuTocCardOrder,
  submitTheCaoSieuTocCard,
} from '@/lib/thecaosieutoc-card';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

class CardRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function providerMessage(payload: Record<string, unknown>, fallback: string) {
  const message = payload.message || payload.msg || payload.error;
  return message === null || message === undefined ? fallback : String(message);
}

function compactOrderNote(payload: Record<string, unknown>) {
  const note = JSON.stringify({
    response: payload,
    synced_at: new Date().toISOString(),
  });
  return note.length > 60_000 ? note.slice(0, 60_000) : note;
}

async function refundFailedBuyOrder(input: {
  userId: number;
  orderId: number;
  amount: number;
  message: string;
  payload?: Record<string, unknown>;
}) {
  return db.$transaction(async (tx) => {
    const order = await tx.card_orders.findUnique({ where: { id: input.orderId } });
    if (!order || ['success', 'refunded'].includes(String(order.status || '').toLowerCase())) {
      return null;
    }

    const user = await tx.users.findUnique({ where: { id: input.userId }, select: { balance: true } });
    if (!user) throw new Error('Không tìm thấy tài khoản để hoàn tiền.');

    const nextBalance = toNumber(user.balance, 0) + input.amount;
    await tx.users.update({
      where: { id: input.userId },
      data: { balance: nextBalance, last_activity: new Date() },
    });
    const updated = await tx.card_orders.update({
      where: { id: input.orderId },
      data: {
        status: 'refunded',
        note: compactOrderNote({
          message: input.message,
          ...(input.payload || {}),
        }),
      },
    });
    await tx.transactions.create({
      data: {
        user_id: input.userId,
        amount: input.amount,
        balance_after: nextBalance,
        wallet_type: 'main',
        type: 'refund',
        status: 'success',
        content: `Hoàn tiền mua thẻ #${input.orderId}`,
      },
    }).catch(() => undefined);
    return updated;
  });
}

export async function POST(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' }, { status: 401 });
  }

  try {
    if (!(await tableExists('card_orders'))) {
      return NextResponse.json(
        { success: false, message: 'Module thẻ cào chưa được cấu hình trong cơ sở dữ liệu hiện tại' },
        { status: 503 }
      );
    }

    const { telco, amount, serial, pin, type } = await req.json();
    const normalizedType = type === 'buy' ? 'buy' : 'exchange';
    const normalizedAmount = Math.trunc(Number(amount));
    const normalizedSerial = String(serial || '').trim();
    const normalizedPin = String(pin || '').trim();
    const normalizedTelco = normalizeTheCaoSieuTocTelco(telco);

    if (!normalizedTelco || !normalizedAmount) {
      return NextResponse.json({ success: false, message: 'Thiếu thông tin thẻ' }, { status: 400 });
    }

    if (normalizedAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Mệnh giá thẻ không hợp lệ' }, { status: 400 });
    }

    if (normalizedType === 'exchange' && (!normalizedSerial || !normalizedPin)) {
      return NextResponse.json({ success: false, message: 'Vui lòng nhập serial và mã PIN để đổi thẻ' }, { status: 400 });
    }

    const requestId = `CARD-${normalizedType.toUpperCase()}-${Date.now()}-${userId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    if (normalizedType === 'buy') {
      const config = await getTheCaoSieuTocCardConfig(true);
      if (!config.buyConfigured || !config.buyAutoSubmit) {
        return NextResponse.json(
          {
            success: false,
            message: !config.buyConfigured
              ? 'Chưa cấu hình token mua thẻ.'
              : 'Chưa bật tự động mua thẻ.',
          },
          { status: 503 }
        );
      }

      const preparedOrder = await db.$transaction(async (tx) => {
        const user = await tx.users.findUnique({ where: { id: userId }, select: { balance: true } });
        if (!user) throw new CardRequestError('Không tìm thấy tài khoản.', 404);

        const currentBalance = toNumber(user.balance, 0);
        if (currentBalance < normalizedAmount) {
          throw new CardRequestError('Số dư ví chính không đủ để mua thẻ. Vui lòng nạp ví chính rồi thử lại.');
        }

        const nextBalance = currentBalance - normalizedAmount;
        await tx.users.update({
          where: { id: userId },
          data: { balance: nextBalance, last_activity: new Date() },
        });
        const order = await tx.card_orders.create({
          data: {
            user_id: userId,
            type: 'buy',
            telco: normalizedTelco,
            card_amount: normalizedAmount,
            amount: normalizedAmount,
            serial: null,
            pin: null,
            api_order_id: requestId,
            status: 'pending',
            note: compactOrderNote({
              message: 'Đã trừ ví chính, đang gọi API mua thẻ.',
              request_id: requestId,
              telco: normalizedTelco,
              amount: normalizedAmount,
            }),
          },
        });
        await tx.transactions.create({
          data: {
            user_id: userId,
            amount: normalizedAmount,
            balance_after: nextBalance,
            wallet_type: 'main',
            type: 'order',
            status: 'success',
            content: `Mua mã thẻ ${normalizedTelco} ${normalizedAmount.toLocaleString('vi-VN')}đ #${order.id}`,
          },
        }).catch(() => undefined);

        return { order, balance_after: nextBalance };
      });

      const providerResult = await buyTheCaoSieuTocCard({
        telco: normalizedTelco,
        amount: normalizedAmount,
        quantity: 1,
      }).catch(async (error) => {
        const message = error instanceof Error ? error.message : 'Không gọi được API mua thẻ';
        await refundFailedBuyOrder({
          userId,
          orderId: preparedOrder.order.id,
          amount: normalizedAmount,
          message,
        });
        throw new CardRequestError(message, 502);
      });

      const statusCode = getTheCaoSieuTocStatusCode(providerResult.payload.status);
      const isSuccess = providerResult.ok && statusCode === 1;
      if (!isSuccess) {
        const message = providerMessage(providerResult.payload, 'API mua thẻ trả về thất bại.');
        await refundFailedBuyOrder({
          userId,
          orderId: preparedOrder.order.id,
          amount: normalizedAmount,
          message,
          payload: providerResult.payload,
        });
        return NextResponse.json(
          {
            success: false,
            message,
            data: { balance_after: preparedOrder.balance_after + normalizedAmount },
          },
          { status: 400 }
        );
      }

      const firstCard = providerResult.cards[0];
      const updatedOrder = await db.card_orders.update({
        where: { id: preparedOrder.order.id },
        data: {
          status: 'success',
          api_order_id: providerResult.orderCode || requestId,
          serial: firstCard?.serial || null,
          pin: firstCard?.code || null,
          note: compactOrderNote({
            message: providerMessage(providerResult.payload, 'Mua thẻ thành công.'),
            provider_order_code: providerResult.orderCode,
            response: providerResult.payload,
            cards: providerResult.cards,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: providerMessage(providerResult.payload, 'Mua thẻ thành công.'),
        data: {
          order: updatedOrder,
          cards: providerResult.cards,
          balance_after: preparedOrder.balance_after,
        },
      });
    }

    const cardOrder = await db.card_orders.create({
      data: {
        user_id: userId,
        type: 'exchange',
        telco: normalizedTelco,
        card_amount: normalizedAmount,
        amount: 0,
        serial: normalizedSerial,
        pin: normalizedPin,
        api_order_id: requestId,
        status: 'pending',
      },
    });

    const config = await getTheCaoSieuTocCardConfig(true);
    if (!config.configured || !config.autoSubmit) {
      return NextResponse.json({
        success: true,
        message: 'Yêu cầu đổi thẻ đã được ghi nhận và đang chờ xử lý.',
        data: cardOrder,
      });
    }

    const providerResult = await submitTheCaoSieuTocCard({
      telco: normalizedTelco,
      amount: normalizedAmount,
      serial: normalizedSerial,
      code: normalizedPin,
      requestId,
    }).catch(async (error) => {
      await db.card_orders.update({
        where: { id: cardOrder.id },
        data: {
          note: JSON.stringify({
            message: error instanceof Error ? error.message : 'Không gửi được API thẻ',
            submitted_at: new Date().toISOString(),
          }).slice(0, 60_000),
        },
      }).catch(() => undefined);
      return null;
    });

    if (!providerResult) {
      return NextResponse.json({
        success: true,
        message: 'Yêu cầu đổi thẻ đã được ghi nhận và đang chờ xử lý.',
        data: cardOrder,
      });
    }

    const statusCode = getTheCaoSieuTocStatusCode(providerResult.payload.status);

    await db.card_orders.update({
      where: { id: cardOrder.id },
      data: {
        note: JSON.stringify({
          response: providerResult.payload,
          http_status: providerResult.httpStatus,
          submitted_at: new Date().toISOString(),
        }).slice(0, 60_000),
      },
    });

    if (statusCode === 1 || statusCode === 2 || statusCode === 3 || (statusCode !== null && statusCode >= 100)) {
      const settleResult = await settleTheCaoSieuTocCardOrder(
        { ...providerResult.payload, request_id: requestId, code: normalizedPin, serial: normalizedSerial },
        { verifySignature: false }
      );
      return NextResponse.json({
        success: settleResult.state !== 'failed',
        message: settleResult.state === 'processed'
          ? 'Thẻ đã xử lý thành công và số dư đã được cập nhật.'
          : 'Thẻ chưa được tiếp nhận. Vui lòng kiểm tra lại thông tin.',
        data: settleResult,
      }, { status: settleResult.state === 'failed' ? 400 : 200 });
    }

    return NextResponse.json({
      success: true,
      message: 'Hệ thống đã nhận thẻ và đang chờ xử lý.',
      data: cardOrder,
    });
  } catch (error) {
    if (error instanceof CardRequestError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    if (process.env.NODE_ENV === 'development') {
      console.warn('[card/exchange] create card order failed', error);
    }
    return NextResponse.json({ success: false, message: 'Không thể tạo giao dịch thẻ' }, { status: 500 });
  }
}
