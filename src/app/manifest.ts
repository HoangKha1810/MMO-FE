import type { MetadataRoute } from 'next';
import { siteDescription, siteName, siteShortName } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: siteShortName,
    description: siteDescription,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0f1a',
    theme_color: '#1d4ed8',
    lang: 'vi',
    orientation: 'portrait',
    categories: ['business', 'productivity', 'social'],
    icons: [
      {
        src: '/favicon.svg?v=3',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/logo.gif?v=3',
        sizes: '700x203',
        type: 'image/gif',
        purpose: 'any',
      },
    ],
  };
}
