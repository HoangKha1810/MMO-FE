import { MAIN_SITE_ORIGIN } from '@/integrations/ai-arena/lib/siteUrls';

export const dynamic = 'force-static';

export function GET() {
  const body = {
    name: 'TrungTamMMO AI Arena',
    short_name: 'TTMMO AI',
    description: 'Không gian chat AI đa mô hình của TrungTamMMO với trò chuyện trực tiếp, so sánh song song và battle mode.',
    lang: 'vi-VN',
    id: '/ai',
    start_url: '/ai',
    scope: '/ai',
    display: 'standalone',
    background_color: '#181512',
    theme_color: '#181512',
    icons: [
      {
        src: `${MAIN_SITE_ORIGIN}/ai-assets/android-chrome-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: `${MAIN_SITE_ORIGIN}/ai-assets/android-chrome-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
