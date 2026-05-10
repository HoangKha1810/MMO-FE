import { AI_SITE_ORIGIN } from '@/integrations/ai-arena/lib/siteUrls';

export const dynamic = 'force-static';

export function GET() {
  const origin = AI_SITE_ORIGIN.replace(/\/+$/, '');
  const body = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
