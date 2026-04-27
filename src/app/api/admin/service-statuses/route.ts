import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi, logAdminAction } from '@/lib/admin-auth';
import {
  getLegacyHomeServiceControls,
  getLegacySetting,
  getLegacySettingsMap,
  invalidateLegacySettingsCache,
} from '@/lib/legacy-settings';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

async function buildServiceStatusPayload() {
  const controls = getLegacyHomeServiceControls();
  const settings = await getLegacySettingsMap(true);

  const items = controls.map((control) => {
    const status = getLegacySetting(settings, control.statusKey, 'active');

    return {
      key: control.key,
      statusKey: control.statusKey,
      title: getLegacySetting(settings, control.nameKey, control.defaultTitle),
      description: getLegacySetting(settings, control.descKey, control.defaultDesc),
      href: control.href,
      external: control.external,
      iconKey: control.iconKey,
      color: control.color,
      textColor: control.textColor,
      status,
      enabled: status !== 'maintenance',
    };
  });

  return {
    items,
    stats: {
      total: items.length,
      active: items.filter((item) => item.enabled).length,
      maintenance: items.filter((item) => !item.enabled).length,
    },
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const payload = await buildServiceStatusPayload();
    return NextResponse.json({ success: true, ...payload }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải trạng thái dịch vụ';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const serviceKey = String(body?.serviceKey || '').trim();
    const enabled = body?.enabled === true;
    const control = getLegacyHomeServiceControls().find((item) => item.key === serviceKey);

    if (!control) {
      throw new Error('Dịch vụ không hợp lệ');
    }

    const nextValue = enabled ? 'active' : 'maintenance';
    const updatedAt = new Date();
    const existing = await db.settings.count({
      where: { setting_key: control.statusKey },
    });

    if (existing > 0) {
      await db.settings.updateMany({
        where: { setting_key: control.statusKey },
        data: {
          setting_value: nextValue,
          updated_at: updatedAt,
        },
      });
    } else {
      await db.settings.create({
        data: {
          setting_key: control.statusKey,
          setting_value: nextValue,
          updated_at: updatedAt,
        },
      });
    }

    invalidateLegacySettingsCache();

    await logAdminAction({
      adminId: auth.user!.id,
      action: enabled ? 'enable service' : 'disable service',
      target: `${serviceKey}:${control.statusKey}:${nextValue}`,
      req,
    });

    const payload = await buildServiceStatusPayload();
    return NextResponse.json(
      {
        success: true,
        message: enabled ? 'Đã bật dịch vụ' : 'Đã tắt dịch vụ',
        ...payload,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật trạng thái dịch vụ';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
