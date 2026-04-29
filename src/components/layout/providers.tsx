'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog-provider';
import { ThemeTransitionLayer } from '@/components/layout/theme-transition-layer';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        enableColorScheme
        disableTransitionOnChange
        storageKey="trungtammmo-theme"
      >
        <ConfirmDialogProvider>
          {children}
          <ThemeTransitionLayer />
        </ConfirmDialogProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
