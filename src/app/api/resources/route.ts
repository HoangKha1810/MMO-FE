import { NextRequest, NextResponse } from 'next/server';
import { listResources, type ResourceCollection } from '@/lib/legacy-modules';
import { hideProviderBranding } from '@/lib/provider-branding';
import { cleanResourceHtml } from '@/lib/resource-content';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const cacheHeaders = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

export async function GET(req: NextRequest) {
  const search = (req.nextUrl.searchParams.get('search') || '').trim();
  const category = (req.nextUrl.searchParams.get('category') || '').trim();
  const collectionParam = (req.nextUrl.searchParams.get('collection') || '').trim();
  const collection = ['game-accounts', 'random-game-accounts'].includes(collectionParam)
    ? collectionParam as ResourceCollection
    : undefined;

  try {
    const resources = await listResources({ search, category, collection, limit: 100 });
    const vatPercent = getVatPercent(await getLegacySettingsMap());
    const data = resources.map((resource) => ({
      ...resource,
      price: Math.round(toNumber(resource.price, 0) * (1 + vatPercent / 100)),
      title: hideProviderBranding(resource.title, String(resource.title || '')),
      description: cleanResourceHtml(resource.description),
      category: hideProviderBranding(resource.category, String(resource.category || '')),
      category_name: hideProviderBranding(resource.category_name, String(resource.category_name || '')),
      custom_badge: hideProviderBranding(resource.custom_badge, String(resource.custom_badge || '')),
      provider_name: hideProviderBranding(resource.provider_name, String(resource.provider_name || '')),
      provider_api_url: undefined,
    }));

    return NextResponse.json({ success: true, data }, { headers: cacheHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải tài nguyên';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
