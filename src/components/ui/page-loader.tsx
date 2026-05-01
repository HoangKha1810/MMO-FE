import { cn } from '@/lib/utils';

export function PageLoader({
  title = 'Đang tải dữ liệu',
  subtitle = 'Hệ thống đang chuẩn bị giao diện và đồng bộ dữ liệu mới nhất.',
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center px-4',
        compact ? 'min-h-[calc(100dvh-7rem)] py-0' : 'min-h-screen py-10'
      )}
    >
      <div
        className={cn(
          'route-loader-shell w-full rounded-[2.2rem] text-center dark:text-white',
          compact ? 'max-w-2xl p-8 sm:p-10 md:p-12' : 'max-w-3xl p-10 sm:p-12 md:p-14'
        )}
      >
        <div className="mx-auto flex w-fit items-center justify-center rounded-[1.9rem] border border-white/20 bg-white/70 p-4 shadow-[0_24px_60px_-30px_rgba(37,99,235,0.38)] dark:bg-white/[0.04] sm:p-5">
          <img src="/logo.gif" alt="TRUNGTAMMMO" className="h-16 w-auto object-contain sm:h-20 md:h-24" />
        </div>

        <div className="mt-8 flex items-center justify-center gap-3.5">
          <span className="h-3 w-3 animate-pulse rounded-full bg-brand-blue" />
          <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-400 [animation-delay:120ms]" />
          <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400 [animation-delay:240ms]" />
        </div>

        <h2 className="mt-7 text-2xl font-black uppercase leading-[1.16] tracking-[-0.02em] text-slate-950 dark:text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm font-medium leading-8 tracking-[0.018em] text-slate-500 dark:text-slate-300 sm:text-base">
          {subtitle}
        </p>

        <div className="mt-8 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.06]">
          <div className="h-2 animate-gradient-xy rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#38bdf8_50%,#10b981_100%)]" />
        </div>
      </div>
    </div>
  );
}
