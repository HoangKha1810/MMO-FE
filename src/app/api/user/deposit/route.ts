import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { reconcilePendingSePayDeposits } from '@/lib/sepay-deposit-sync';
import { buildSePayCheckout } from '@/lib/sepay';
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
  type: string;
  status: string;
  created_at: Date;
}) {
  return {
    id: row.id,
    transaction_id: `TX-${row.id}`,
    amount: toNumber(row.amount, 0),
    balance_after: toNumber(row.balance_after, 0),
    content: row.content || '',
    payment_method: row.content?.startsWith('SEP') ? 'sepay_qr' : 'legacy_deposit',
    bank: '',
    type: row.type,
    status: row.status,
    created_at: serializeDatabaseDateTime(row.created_at),
  };
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '20', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';

  const skip = (page - 1) * perPage;

  try {
    await reconcilePendingSePayDeposits({
      userId,
      limit: 8,
    }).catch(() => null);

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
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const { amount, payment_method, content } = await req.json();
    const normalizedAmount = Math.round(toNumber(amount, 0));
    const requestedMethod = String(payment_method || 'sepay').trim().toLowerCase();
    const method = requestedMethod === 'bank_transfer' ? 'bank' : requestedMethod;

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

      const transactionCode = `SEP${userId}T${Date.now()}`;
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
          type: true,
          status: true,
          created_at: true,
        },
      });

      const sepayCheckout = buildSePayCheckout({
        amount: normalizedAmount,
        customerId: String(userId),
        description: `Nap tien vi ${user?.username || `User#${userId}`} (UID ${userId})`,
        orderId: transactionCode,
        origin: req.nextUrl.origin,
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

      return NextResponse.json({
        success: true,
        message: 'Đã tạo yêu cầu Thanh Toán QR Code',
        method: 'sepay',
        data: normalizeTransaction(deposit),
        payment: {
          order_id: transactionCode,
          checkout_url: sepayCheckout.checkoutUrl,
          fields: sepayCheckout.fields,
          ipn_url: sepayCheckout.config.ipnUrl,
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
