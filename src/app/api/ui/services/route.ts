import { NextResponse } from 'next/server';
import {
  getHomeServiceGrid,
  getLegacySetting,
  getLegacySettingsMap,
  getSidebarServiceCatalog,
} from '@/lib/legacy-settings';

const cacheHeaders = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

export async function GET() {
  try {
    const settings = await getLegacySettingsMap();
    const configuredLogo = getLegacySetting(settings, 'site_logo', 'logo.gif');

    return NextResponse.json({
      success: true,
      siteName: getLegacySetting(settings, 'site_name', 'TRUNGTAMMMO'),
      siteLogo: configuredLogo.includes('logohtbmmo') ? 'logo.gif' : configuredLogo,
      home: getHomeServiceGrid(settings),
      sidebar: getSidebarServiceCatalog(settings),
    }, { headers: cacheHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải cấu hình giao diện';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
