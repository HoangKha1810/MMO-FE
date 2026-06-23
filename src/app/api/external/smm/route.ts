import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateSmmApiRequest,
  createExternalSmmOrder,
  getExternalSmmQuote,
  getExternalSmmStatus,
  getExternalSmmProfile,
  listExternalSmmCategories,
  listExternalSmmOrders,
  listExternalSmmServices,
  readExternalSmmRequestBody,
  toExternalSmmSearchParams,
} from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeAction(value: unknown) {
  const action = String(value || '').trim().toLowerCase();
  if (['add_order', 'order', 'create'].includes(action)) return 'add';
  if (['orders_status', 'multi_status', 'multiple_status'].includes(action)) return 'status';
  if (['services', 'add', 'status', 'balance', 'quote', 'categories', 'orders', 'profile'].includes(action)) return action;
  return action || 'services';
}

async function handleExternalSmmAction(req: NextRequest, body: Record<string, unknown> = {}) {
  const mergedInput = {
    ...Object.fromEntries(req.nextUrl.searchParams.entries()),
    ...body,
  };
  const auth = await authenticateSmmApiRequest(req, mergedInput);

  if (!auth.success || !auth.account) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const action = normalizeAction(mergedInput.action);
  const params = toExternalSmmSearchParams(mergedInput);

  switch (action) {
    case 'services':
      return NextResponse.json(await listExternalSmmServices(params));
    case 'categories':
      return NextResponse.json(await listExternalSmmCategories(params));
    case 'quote':
      return NextResponse.json(await getExternalSmmQuote(mergedInput));
    case 'add': {
      if (req.method !== 'POST') {
        return NextResponse.json(
          { success: false, message: 'Tạo đơn SMM chỉ hỗ trợ POST' },
          { status: 405 }
        );
      }

      const data = await createExternalSmmOrder(auth.account, mergedInput);
      return NextResponse.json(data, { status: data.success ? 200 : 200 });
    }
    case 'status':
      return NextResponse.json(await getExternalSmmStatus(auth.account, params));
    case 'orders':
      return NextResponse.json(await listExternalSmmOrders(auth.account, params));
    case 'profile':
      return NextResponse.json(await getExternalSmmProfile(auth.account));
    case 'balance': {
      const profile = await getExternalSmmProfile(auth.account);
      return NextResponse.json({
        success: true,
        balance: profile.data.balance,
        currency: 'VND',
        data: profile.data,
      });
    }
    default:
      return NextResponse.json(
        { success: false, message: 'Action không hợp lệ. Hỗ trợ: services, add, status, balance, quote, categories, orders, profile' },
        { status: 400 }
      );
  }
}

export async function GET(req: NextRequest) {
  try {
    return await handleExternalSmmAction(req);
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý API SMM' },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await readExternalSmmRequestBody(req);

  try {
    return await handleExternalSmmAction(req, body);
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý API SMM' },
      { status }
    );
  }
}
