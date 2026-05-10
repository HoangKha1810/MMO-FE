import { siteConfig } from '@/integrations/vps-portal/lib/site';

export const dynamic = 'force-static';

export function GET() {
  const origin = siteConfig.siteUrl.replace(/\/+$/, '');
  const body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
