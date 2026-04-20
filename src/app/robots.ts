import type { MetadataRoute } from 'next';
import { buildAbsoluteUrl, siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/privacy', '/terms'],
        disallow: ['/admin/', '/auth/', '/user/', '/api/'],
      },
    ],
    sitemap: [buildAbsoluteUrl('/sitemap.xml')],
    host: siteUrl,
  };
}

