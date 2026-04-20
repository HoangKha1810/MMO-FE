import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function authorized(req: NextRequest) {
  const key = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key') || '';
  return !process.env.API_KEY || key === process.env.API_KEY;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, message: 'Invalid API key' }, { status: 401 });
  }

  const [staleSmm, staleAuto, expiredAds] = await Promise.all([
    db.$executeRawUnsafe(`
      UPDATE smm_orders
      SET status = 'Failed', reason = COALESCE(NULLIF(reason, ''), 'Cron timeout')
      WHERE status IN ('Pending', 'Processing', 'In progress')
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `).catch(() => 0),
    db.$executeRawUnsafe(`
      UPDATE automxh_orders
      SET status = 'canceled'
      WHERE status IN ('pending', 'processing')
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `).catch(() => 0),
    db.$executeRawUnsafe(`
      UPDATE forum_ads
      SET status = 'expired'
      WHERE status = 'approved'
        AND active_to IS NOT NULL
        AND active_to < NOW()
    `).catch(() => 0),
  ]);

  await db.activity_logs.create({
    data: {
      activity: `Cron run: smm=${Number(staleSmm || 0)}, automxh=${Number(staleAuto || 0)}, ads=${Number(expiredAds || 0)}`,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    data: {
      stale_smm: Number(staleSmm || 0),
      stale_automxh: Number(staleAuto || 0),
      expired_ads: Number(expiredAds || 0),
    },
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
