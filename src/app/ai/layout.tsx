import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const aiGlobalCss = readFileSync(
  join(process.cwd(), 'src/integrations/ai-arena/styles/global.css'),
  'utf8'
);

export const metadata: Metadata = {
  title: 'AI Manager',
  description: 'Không gian AI đa mô hình của TRUNGTAMMMO.',
  alternates: {
    canonical: '/ai',
  },
  manifest: '/ai/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/ai-assets/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/ai-assets/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/ai-assets/favicon.ico' },
    ],
    apple: [{ url: '/ai-assets/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AiLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: aiGlobalCss }} />
      <div className="ai-route-shell">{children}</div>
    </>
  );
}
