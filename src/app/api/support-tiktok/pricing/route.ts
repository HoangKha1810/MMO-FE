import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { db } from '@/lib/db';
import { getSupportTiktokContext } from '@/lib/support-tiktok';
import { toNumber } from '@/lib/utils';

interface PricingRow {
  id: number;
  region_slug: string | null;
  name: string | null;
  service_key: string | null;
  price: number | string | null;
  description: string | null;
  display_order: number | string | null;
  status: string | null;
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    undefined
  );
}

function slugPart(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function normalizePricingRow(row: PricingRow) {
  return {
    id: Number(row.id),
    region_slug: String(row.region_slug || ''),
    name: String(row.name || ''),
    service_key: String(row.service_key || ''),
    price: toNumber(row.price, 0),
    description: String(row.description || ''),
    display_order: Number(row.display_order || 0),
    status: String(row.status || 'active'),
  };
}

async function requireSupport(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();
  if (!userId) {
    return { error: NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }) };
  }

  const context = await getSupportTiktokContext(userId, getClientIp(req));
  if (!context) {
    return { error: NextResponse.json({ success: false, message: 'User not found' }, { status: 404 }) };
  }
  if (!context.isSupport) {
    return { error: NextResponse.json({ success: false, message: 'Chỉ nhân viên hỗ trợ TikTok được chỉnh bảng giá' }, { status: 403 }) };
  }

  return { context };
}

export async function GET(req: NextRequest) {
  const auth = await requireSupport(req);
  if (auth.error) return auth.error;

  const rows = await db.$queryRawUnsafe<PricingRow[]>(
    `
      SELECT id, region_slug, name, service_key, price, description, display_order, status
      FROM tiktok_region_services
      ORDER BY
        CASE region_slug
          WHEN 'jp' THEN 0
          WHEN 'vn' THEN 1
          ELSE 2
        END,
        region_slug ASC,
        display_order ASC,
        id ASC
    `
  );

  return NextResponse.json({
    success: true,
    data: rows.map(normalizePricingRow),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSupport(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim().toLowerCase();
  const id = Number(body.id || 0);

  if (action === 'delete') {
    if (!id) {
      return NextResponse.json({ success: false, message: 'Thiếu id gói cần xóa' }, { status: 400 });
    }

    await db.$executeRawUnsafe('DELETE FROM tiktok_region_services WHERE id = ?', id);
    return NextResponse.json({ success: true, message: 'Đã xóa gói Support TikTok' });
  }

  const regionSlug = slugPart(body.region_slug || 'jp') || 'jp';
  const name = String(body.name || '').trim();
  const price = Math.max(0, Math.round(toNumber(body.price, 0)));
  const description = String(body.description || name).trim();
  const status = String(body.status || 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';
  const displayOrder = Math.max(0, Math.trunc(toNumber(body.display_order, 0)));
  const serviceKey = slugPart(body.service_key || name || `goi-${Date.now()}`) || `goi-${Date.now()}`;

  if (!name) {
    return NextResponse.json({ success: false, message: 'Thiếu tên gói' }, { status: 400 });
  }

  if (action === 'create') {
    await db.$executeRawUnsafe(
      `
        INSERT INTO tiktok_region_services
          (region_slug, name, service_key, price, description, display_order, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      regionSlug,
      name,
      serviceKey,
      price,
      description,
      displayOrder,
      status
    );

    return NextResponse.json({ success: true, message: 'Đã thêm gói Support TikTok' });
  }

  if (action === 'update') {
    if (!id) {
      return NextResponse.json({ success: false, message: 'Thiếu id gói cần sửa' }, { status: 400 });
    }

    await db.$executeRawUnsafe(
      `
        UPDATE tiktok_region_services
        SET region_slug = ?,
            name = ?,
            service_key = ?,
            price = ?,
            description = ?,
            display_order = ?,
            status = ?,
            updated_at = NOW()
        WHERE id = ?
      `,
      regionSlug,
      name,
      serviceKey,
      price,
      description,
      displayOrder,
      status,
      id
    );

    return NextResponse.json({ success: true, message: 'Đã lưu bảng giá Support TikTok' });
  }

  return NextResponse.json({ success: false, message: 'Action không hợp lệ' }, { status: 400 });
}
