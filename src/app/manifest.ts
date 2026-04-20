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
        src: '/favicon.ico',
        sizes: '16x16 32x32 48x48',
        type: 'image/x-icon',
      },
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}

