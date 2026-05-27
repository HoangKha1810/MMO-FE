import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default async function GuestBlockPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const ip = String(params.ip || 'IP hiện tại');
  const reason = String(params.reason || 'Địa chỉ IP này đang bị khóa do vượt giới hạn hoặc bị admin blacklist.');

  return (
    <main className="mmo-board flex min-h-screen items-center justify-center px-5">
      <section className="mmo-edge-card max-w-xl p-8 text-center">
        <div className="relative z-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-rose-500/10 text-rose-500">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-4xl font-black uppercase tracking-[-0.06em] text-white">IP đã bị khóa</h1>
        <p className="mt-4 text-sm font-semibold leading-8 text-slate-300">{reason}</p>
        <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 font-mono text-sm font-black text-rose-500">{ip}</div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/auth/login" className="surface-chip rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-200">Đăng nhập lại</Link>
          <a href="mailto:admin@trungtammmo.vn" className="btn-kinetic rounded-full bg-rose-500 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white">Liên hệ admin</a>
        </div>
        </div>
      </section>
    </main>
  );
}
