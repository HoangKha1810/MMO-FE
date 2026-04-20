import { cn } from '@/lib/utils';

export function PageLoader({
  title = 'Đang tải dữ liệu',
  subtitle = 'Hệ thống đang chuẩn bị giao diện và đồng bộ dữ liệu từ MySQL.',
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex min-h-[50vh] items-center justify-center px-4 py-10', compact && 'min-h-[32vh] py-6')}>
      <div className="route-loader-shell w-full max-w-xl rounded-[2rem] p-8 text-center dark:text-white">
        <div className="mx-auto flex w-fit items-center justify-center rounded-[1.6rem] border border-white/20 bg-white/70 p-3 shadow-[0_18px_40px_-26px_rgba(37,99,235,0.38)] dark:bg-white/[0.04]">
          <img src="/logo.gif" alt="TRUNGTAMMMO" className="h-12 w-auto object-contain sm:h-14" />
        </div>

        <div className="mt-7 flex items-center justify-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-blue" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:120ms]" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:240ms]" />
        </div>

        <h2 className="mt-6 text-2xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-7 text-slate-500 dark:text-slate-300">
          {subtitle}
        </p>

        <div className="mt-7 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.06]">
          <div className="h-1.5 animate-gradient-xy rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#38bdf8_50%,#10b981_100%)]" />
        </div>
      </div>
    </div>
  );
}
