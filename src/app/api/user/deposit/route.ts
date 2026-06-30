import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { buildSePayReferenceContent, extractSePayPaymentReferenceCodes, getPrimarySePayReferenceCode } from '@/lib/sepay-codes';
import { reconcilePendingSePayDeposits } from '@/lib/sepay-deposit-sync';
import { createSePayCheckoutSession } from '@/lib/sepay';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function normalizeTransaction(row: {
  id: number;
  amount: unknown;
  balance_after: unknown;
  content: string | null;
  wallet_type?: string | null;
  type: string;
  status: string;
  created_at: Date;
}) {
  const wallet = String(row.wallet_type || '').toLowerCase() === 'game' ||
    String(row.content || '').toUpperCase().includes('WALLET:GAME') ||
    String(row.content || '').toUpperCase().startsWith('GAMESEP')
    ? 'game'
    : 'main';

  return {
    id: row.id,
    transaction_id: `TX-${row.id}`,
    amount: toNumber(row.amount, 0),
    balance_after: toNumber(row.balance_after, 0),
    content: getPrimarySePayReferenceCode(row.content),
    wallet,
    payment_method: extractSePayPaymentReferenceCodes(row.content).length > 0 ? 'sepay_qr' : 'legacy_deposit',
    bank: '',
    type: row.type,
    status: row.status,
    created_at: serializeDatabaseDateTime(row.created_at),
  };
}

export async function GET(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '20', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const shouldSync = searchParams.get('sync') === '1';

  const skip = (page - 1) * perPage;

  try {
    if (shouldSync) {
      await reconcilePendingSePayDeposits({
        userId,
        limit: Math.min(Math.max(perPage, 1), 5),
      }).catch(() => null);
    }

    const where: Record<string, unknown> = {
      user_id: userId,
      type: 'deposit',
    };

    if (search) {
      where.OR = [
        { content: { contains: search } },
        { id: !Number.isNaN(Number(search)) ? Number(search) : -1 },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [deposits, total] = await Promise.all([
      db.transactions.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: perPage,
        select: {
          id: true,
          amount: true,
          balance_after: true,
          content: true,
          wallet_type: true,
          type: true,
          status: true,
          created_at: true,
        },
      }),
      db.transactions.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: deposits.map(normalizeTransaction),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / perPage),
        total_items: total,
        per_page: perPage,
      },
    }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const { amount, payment_method, content, wallet_type, wallet } = await req.json();
    const normalizedAmount = Math.round(toNumber(amount, 0));
    const requestedMethod = String(payment_method || 'sepay').trim().toLowerCase();
    const method = requestedMethod === 'bank_transfer' ? 'bank' : requestedMethod;
    const walletType = ['game', 'game_wallet'].includes(String(wallet_type || wallet || '').trim().toLowerCase())
      ? 'game'
      : 'main';

    if (!normalizedAmount || normalizedAmount < 10000) {
      return NextResponse.json({ success: false, message: 'Số tiền nạp tối thiểu là 10,000đ' }, { status: 400, headers: noStoreHeaders });
    }

    if (method === 'bank') {
      return NextResponse.json(
        { success: false, message: 'Chuyển khoản ngân hàng đã tắt. Vui lòng dùng Thanh Toán QR Code.' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (method === 'sepay') {
      const user = await db.users.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      const transactionCode = `${walletType === 'game' ? 'GAMESEP' : 'SEP'}${userId}T${Date.now()}`;
      const deposit = await db.transactions.create({
        data: {
          user_id: userId,
          amount: normalizedAmount,
          balance_after: 0,
          wallet_type: walletType,
          type: 'deposit',
          status: 'pending',
          content: transactionCode,
        },
        select: {
          id: true,
          amount: true,
          balance_after: true,
          content: true,
          wallet_type: true,
          type: true,
          status: true,
          created_at: true,
        },
      });

      const sepayCheckout = await createSePayCheckoutSession({
        amount: normalizedAmount,
        customerId: String(userId),
        description: walletType === 'game'
          ? `Nap tien vi game ${user?.username || `User#${userId}`} (UID ${userId})`
          : `Nap tien vi ${user?.username || `User#${userId}`} (UID ${userId})`,
        orderId: transactionCode,
        origin: req.nextUrl.origin,
        wallet: walletType,
      });

      if (!sepayCheckout.success) {
        await db.transactions.update({
          where: { id: deposit.id },
          data: { status: 'failed' },
        });

        return NextResponse.json(
          { success: false, message: sepayCheckout.message },
          { status: 500, headers: noStoreHeaders }
        );
      }

      const storedContent = buildSePayReferenceContent([
        sepayCheckout.sepayOrderId,
        transactionCode,
      ]);

      const updatedDeposit = await db.transactions.update({
        where: { id: deposit.id },
        data: {
          content: storedContent || transactionCode,
          wallet_type: walletType,
        },
        select: {
          id: true,
          amount: true,
          balance_after: true,
          content: true,
          wallet_type: true,
          type: true,
          status: true,
          created_at: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: walletType === 'game'
          ? 'Đã tạo yêu cầu nạp ví game bằng Thanh Toán QR Code'
          : 'Đã tạo yêu cầu Thanh Toán QR Code',
        method: 'sepay',
        data: normalizeTransaction(updatedDeposit),
        payment: {
          order_id: transactionCode,
          sepay_order_id: sepayCheckout.sepayOrderId,
          checkout_url: sepayCheckout.checkoutUrl,
          checkout_redirect_url: sepayCheckout.redirectUrl,
          fields: sepayCheckout.fields,
          ipn_url: sepayCheckout.config.ipnUrl,
          wallet: walletType,
        },
      }, { headers: noStoreHeaders });
    }

    if (method === 'momo') {
      const user = await db.users.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      const transactionCode = `MOMO${userId}T${Date.now()}`;
      const deposit = await db.transactions.create({
        data: {
          user_id: userId,
          amount: normalizedAmount,
          balance_after: 0,
          type: 'deposit',
          status: 'pending',
          content: transactionCode,
        },
        select: {
          id: true,
          amount: true,
          balance_after: true,
          content: true,
          wallet_type: true,
          type: true,
          status: true,
          created_at: true,
        },
      });

      const momoPhone = process.env.MOMO_PHONE || process.env.MOMO_ACCOUNT || '';
      const momoName = process.env.MOMO_ACCOUNT_NAME || 'TRUNGTAMMMO';
      const qrUrl = momoPhone
        ? `https://img.vietqr.io/image/MOMO-${encodeURIComponent(momoPhone)}-compact.png?amount=${normalizedAmount}&addInfo=${encodeURIComponent(transactionCode)}&accountName=${encodeURIComponent(momoName)}`
        : '';

      return NextResponse.json({
        success: true,
        message: 'Đã tạo yêu cầu nạp Ví MoMo',
        method: 'momo',
        data: normalizeTransaction(deposit),
        payment: {
          order_id: transactionCode,
          amount: normalizedAmount,
          account: momoPhone,
          account_name: momoName,
          qr_url: qrUrl,
          note: transactionCode,
          description: `Nap tien vi ${user?.username || `User#${userId}`} (UID ${userId})`,
        },
      }, { headers: noStoreHeaders });
    }

    const deposit = await db.transactions.create({
      data: {
        user_id: userId,
        amount: normalizedAmount,
        balance_after: 0,
        wallet_type: 'main',
        type: 'deposit',
        status: 'pending',
        content:
          String(content || '').trim() ||
          `Yêu cầu nạp tiền ${normalizedAmount.toLocaleString('vi-VN')}đ qua ${method}`,
      },
      select: {
        id: true,
        amount: true,
        balance_after: true,
        content: true,
        wallet_type: true,
        type: true,
        status: true,
        created_at: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Yêu cầu nạp tiền đã được tạo',
      data: normalizeTransaction(deposit),
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('Deposit error:', error);
    return NextResponse.json({ success: false, message: 'Có lỗi xảy ra' }, { status: 500, headers: noStoreHeaders });
  }
}
