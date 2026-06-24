import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAutoMxhApiRequest,
  createExternalAutoMxhOrder,
  getExternalAutoMxhProfile,
  getExternalAutoMxhQuote,
  getExternalAutoMxhStatus,
  listExternalAutoMxhCatalog,
  listExternalAutoMxhOrders,
  listExternalAutoMxhServices,
  readExternalAutoMxhRequestBody,
  toExternalAutoMxhSearchParams,
} from '@/lib/automxh-external-api';
import {
  createExternalApiSePayDepositCheckout,
  creditExternalApiBalance,
  listExternalApiTransactions,
} from '@/lib/external-wallet-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeAction(value: unknown) {
  const action = String(value || '').trim().toLowerCase();
  if (['add_order', 'order', 'create'].includes(action)) return 'add';
  if (['catalog', 'categories'].includes(action)) return 'catalog';
  if (['deposit', 'topup', 'recharge'].includes(action)) return 'deposit';
  if (['deposit_checkout', 'checkout', 'sepay_checkout', 'create_deposit_qr'].includes(action)) return 'deposit_checkout';
  if (['transactions', 'history', 'deposit_history', 'deposits_history'].includes(action)) return 'transactions';
  if (['services', 'add', 'status', 'balance', 'quote', 'orders', 'profile', 'catalog', 'deposit', 'deposit_checkout', 'transactions'].includes(action)) return action;
  return action || 'services';
}

async function handleExternalAutoMxhAction(req: NextRequest, body: Record<string, unknown> = {}) {
  const mergedInput = {
    ...Object.fromEntries(req.nextUrl.searchParams.entries()),
    ...body,
  };
  const auth = await authenticateAutoMxhApiRequest(req, mergedInput);

  if (!auth.success || !auth.account) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const action = normalizeAction(mergedInput.action);
  const params = toExternalAutoMxhSearchParams(mergedInput);

  switch (action) {
    case 'services':
      return NextResponse.json(await listExternalAutoMxhServices(params));
    case 'catalog':
      return NextResponse.json(await listExternalAutoMxhCatalog(params));
    case 'quote':
      return NextResponse.json(await getExternalAutoMxhQuote(mergedInput));
    case 'add': {
      if (req.method !== 'POST') {
        return NextResponse.json(
          { success: false, message: 'Tạo đơn Auto MXH chỉ hỗ trợ POST' },
          { status: 405 }
        );
      }

      return NextResponse.json(await createExternalAutoMxhOrder(auth.account, mergedInput));
    }
    case 'deposit': {
      if (req.method !== 'POST') {
        return NextResponse.json(
          { success: false, message: 'Nạp tiền qua API chỉ hỗ trợ POST' },
          { status: 405 }
        );
      }

      return NextResponse.json(await creditExternalApiBalance(auth.account, mergedInput, 'Auto MXH API'));
    }
    case 'deposit_checkout': {
      if (req.method !== 'POST') {
        return NextResponse.json(
          { success: false, message: 'Tạo QR nạp tiền chỉ hỗ trợ POST' },
          { status: 405 }
        );
      }

      return NextResponse.json(
        await createExternalApiSePayDepositCheckout(auth.account, mergedInput, 'Auto MXH API', req.nextUrl.origin)
      );
    }
    case 'transactions':
      return NextResponse.json(await listExternalApiTransactions(auth.account, params));
    case 'status':
      return NextResponse.json(await getExternalAutoMxhStatus(auth.account, params));
    case 'orders':
      return NextResponse.json(await listExternalAutoMxhOrders(auth.account, params));
    case 'profile':
      return NextResponse.json(await getExternalAutoMxhProfile(auth.account));
    case 'balance': {
      const profile = await getExternalAutoMxhProfile(auth.account);
      return NextResponse.json({
        success: true,
        balance: profile.data.balance,
        currency: 'VND',
        data: profile.data,
      });
    }
    default:
      return NextResponse.json(
        { success: false, message: 'Action không hợp lệ. Hỗ trợ: services, catalog, add, status, balance, quote, orders, profile, deposit, deposit_checkout, transactions' },
        { status: 400 }
      );
  }
}

export async function GET(req: NextRequest) {
  try {
    return await handleExternalAutoMxhAction(req);
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý API Auto MXH' },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await readExternalAutoMxhRequestBody(req);

  try {
    return await handleExternalAutoMxhAction(req, body);
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý API Auto MXH' },
      { status }
    );
  }
}
