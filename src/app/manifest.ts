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
        src: '/icon-192.png?v=4',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png?v=4',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon.svg?v=4',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
