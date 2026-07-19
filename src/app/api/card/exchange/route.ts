import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { db } from '@/lib/db';
import { tableExists } from '@/lib/legacy-modules';
import {
  getTheCaoSieuTocCardConfig,
  getTheCaoSieuTocStatusCode,
  normalizeTheCaoSieuTocTelco,
  settleTheCaoSieuTocCardOrder,
  submitTheCaoSieuTocCard,
} from '@/lib/thecaosieutoc-card';

export const dynamic = 'force-dynamic';

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

    if (!normalizedTelco || !normalizedAmount || !normalizedSerial || !normalizedPin) {
      return NextResponse.json({ success: false, message: 'Thiếu thông tin thẻ' }, { status: 400 });
    }

    if (normalizedAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Mệnh giá thẻ không hợp lệ' }, { status: 400 });
    }

    const requestId = `CARD-${Date.now()}-${userId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const cardOrder = await db.card_orders.create({
      data: {
        user_id: userId,
        type: normalizedType,
        telco: normalizedTelco,
        card_amount: normalizedAmount,
        amount: normalizedType === 'buy' ? normalizedAmount : 0,
        serial: normalizedSerial,
        pin: normalizedPin,
        api_order_id: requestId,
        status: 'pending',
      },
    });

    if (normalizedType === 'buy') {
      return NextResponse.json({
        success: true,
        message: 'Yêu cầu mua mã thẻ đã được ghi nhận',
        data: cardOrder,
      });
    }

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
    if (process.env.NODE_ENV === 'development') {
      console.warn('[card/exchange] create card order failed', error);
    }
    return NextResponse.json({ success: false, message: 'Không thể tạo giao dịch thẻ' }, { status: 500 });
  }
}
