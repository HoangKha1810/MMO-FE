import { siteConfig } from '@/integrations/vps-portal/lib/site';

export const dynamic = 'force-static';

export function GET() {
  const body = {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: '/vps',
    id: '/vps',
    scope: '/vps',
    display: 'standalone',
    lang: 'vi',
    orientation: 'portrait',
    background_color: '#08111d',
    theme_color: '#1f4ed8',
    categories: ['technology', 'business', 'hosting'],
    icons: [
      {
        src: siteConfig.icon192Path,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: siteConfig.icon512Path,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: siteConfig.maskableIconPath,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
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
