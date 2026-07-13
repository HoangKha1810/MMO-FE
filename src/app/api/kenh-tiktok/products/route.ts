import { NextRequest, NextResponse } from 'next/server';
import { listTikTokChannelProducts } from '@/lib/tiktok-channel';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const result = await listTikTokChannelProducts({
      page: Math.trunc(toNumber(params.get('page'), 1)),
      perPage: Math.trunc(toNumber(params.get('per_page'), 16)),
      search: params.get('search') || '',
      niche: params.get('niche') || '',
      minFollowers: Math.trunc(toNumber(params.get('min_followers'), 0)),
      maxFollowers: Math.trunc(toNumber(params.get('max_followers'), 0)),
    });

    return NextResponse.json({ success: true, ...result }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được danh sách kênh TikTok';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}
