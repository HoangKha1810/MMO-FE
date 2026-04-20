import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { buildSePayCheckout } from '@/lib/sepay';
import { toNumber } from '@/lib/utils';

interface LegacyBankRow {
  id: number;
  name: string | null;
  account_name: string | null;
  account_number: string | null;
  is_active: number | boolean;
}

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
    payment_method: 'bank_transfer',
    bank: '',
    type: row.type,
    status: row.status,
    created_at: row.created_at,
  };
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '20', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';

  const skip = (page - 1) * perPage;

  try {
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
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { amount, payment_method, bank_id, content } = await req.json();
    const normalizedAmount = Math.round(toNumber(amount, 0));
    const requestedMethod = String(payment_method || 'sepay').trim().toLowerCase();
    const method = requestedMethod === 'bank_transfer' ? 'bank' : requestedMethod;

    if (!normalizedAmount || normalizedAmount < 10000) {
      return NextResponse.json({ success: false, message: 'Số tiền nạp tối thiểu là 10,000đ' }, { status: 400 });
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
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Đã tạo yêu cầu thanh toán SePay',
        method: 'sepay',
        data: normalizeTransaction(deposit),
        payment: {
          order_id: transactionCode,
          checkout_url: sepayCheckout.checkoutUrl,
          fields: sepayCheckout.fields,
          ipn_url: sepayCheckout.config.ipnUrl,
        },
      });
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
      });
    }

    if (method === 'bank') {
      const bankId = Number(bank_id || 0);
      const activeBanks = await db.$queryRawUnsafe<LegacyBankRow[]>(
        `
          SELECT id, name, account_name, account_number, is_active
          FROM banks
          WHERE is_active = 1
            ${bankId > 0 ? 'AND id = ?' : ''}
          ORDER BY id ASC
          LIMIT 1
        `,
        ...(bankId > 0 ? [bankId] : [])
      );

      const bank = activeBanks[0];
      if (!bank) {
        return NextResponse.json(
          { success: false, message: 'Không tìm thấy ngân hàng đang hoạt động' },
          { status: 400 }
        );
      }

      const transactionCode = `NAP${userId}T${Date.now()}`;
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

      const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(
        String(bank.name || 'BANK')
      )}-${encodeURIComponent(String(bank.account_number || ''))}-compact.png?amount=${normalizedAmount}&addInfo=${encodeURIComponent(
        transactionCode
      )}&accountName=${encodeURIComponent(String(bank.account_name || ''))}`;

      return NextResponse.json({
        success: true,
        message: 'Đã tạo yêu cầu chuyển khoản ngân hàng',
        method: 'bank',
        data: normalizeTransaction(deposit),
        bank: {
          id: Number(bank.id),
          bank_name: String(bank.name || ''),
          account_name: String(bank.account_name || ''),
          account_number: String(bank.account_number || ''),
          amount: normalizedAmount,
          transaction_code: transactionCode,
          qr_url: qrUrl,
        },
      });
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
      message: 'Yêu cầu nạp tiền đã được tạo trong MySQL cũ',
      data: normalizeTransaction(deposit),
    });
  } catch (error) {
    console.error('Deposit error:', error);
    return NextResponse.json({ success: false, message: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
