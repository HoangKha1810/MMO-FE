// src/app/layout.tsx
import type { Metadata } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { Providers } from '@/components/layout/providers';
import { NavigationEffects, RouteStage } from '@/components/layout/navigation-effects';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TRUNGTAMMMO.VN',
    template: '%s | TRUNGTAMMMO.VN',
  },
  description: 'Nền tảng MMO đa dịch vụ được chuyển từ source PHP sang kiến trúc FE/BE hiện đại.',
  keywords: ['MMO', 'SMM', 'Social Media Marketing', 'Auto MXH', 'Forum', 'Game Market'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${plusJakartaSans.variable} ${jetBrainsMono.variable} font-sans antialiased`}>
        <Providers>
          <NavigationEffects />
          <RouteStage>{children}</RouteStage>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
