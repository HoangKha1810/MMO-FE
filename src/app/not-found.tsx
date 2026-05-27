import Link from 'next/link';
import { ArrowLeft, Home, SearchX, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <main className="mmo-board mmo-board-page">
      <section className="mmo-edge-shell mx-auto max-w-5xl">
        <div className="mmo-edge-card p-5 sm:p-8 md:p-10">
          <div className="relative z-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_320px] md:items-center">
            <div className="min-w-0">
              <div className="mmo-eyebrow">404 / Không tìm thấy</div>
              <h1 className="mt-4 text-4xl font-black uppercase leading-tight tracking-[-0.02em] text-white sm:text-6xl">
                Trang không tồn tại
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-300">
                Đường dẫn này không còn khả dụng hoặc đã được chuyển sang khu vực khác trong hệ thống TRUNGTAMMMO.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    Về trang chủ
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/user/home">
                    <ArrowLeft className="h-4 w-4" />
                    Mở dashboard
                  </Link>
                </Button>
              </div>
            </div>

            <div className="surface-panel relative z-10 rounded-[1rem] p-5">
              <div className="flex h-24 w-24 items-center justify-center rounded-[1rem] border border-sky-400/20 bg-sky-400/10 text-sky-300">
                <SearchX className="h-12 w-12" />
              </div>
              <div className="mt-5 space-y-3">
                <div className="mmo-activity-row">
                  <span className="mmo-activity-icon mmo-activity-blue">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs font-black uppercase text-white">Hệ thống an toàn</div>
                    <div className="text-[11px] font-bold text-slate-400">Không có thao tác nào bị thực hiện</div>
                  </div>
                </div>
                <div className="mmo-skeleton h-3 w-full" />
                <div className="mmo-skeleton h-3 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
