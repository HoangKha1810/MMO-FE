'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mmo-board mmo-board-page">
      <section className="mmo-edge-shell mx-auto max-w-4xl">
        <div className="mmo-edge-card p-5 sm:p-8 md:p-10">
          <div className="relative z-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1rem] border border-amber-400/25 bg-amber-400/10 text-amber-300">
              <AlertTriangle className="h-10 w-10" />
            </div>
            <div className="mmo-eyebrow mt-6">Runtime / Edge state</div>
            <h1 className="mt-3 text-3xl font-black uppercase leading-tight tracking-[-0.02em] text-white sm:text-5xl">
              Có lỗi khi tải trang
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-300">
              Hệ thống chưa hoàn tất yêu cầu hiện tại. Bạn có thể thử tải lại màn này để tiếp tục thao tác.
            </p>
            <Button type="button" className="mt-7" onClick={reset}>
              <RefreshCcw className="h-4 w-4" />
              Tải lại
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
