import type { MetadataRoute } from 'next';
import { buildAbsoluteUrl, publicSeoRoutes } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicSeoRoutes.map((route) => ({
    url: buildAbsoluteUrl(route),
    lastModified: now,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.7,
  }));
}

