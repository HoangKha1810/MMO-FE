import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Shield, Sparkles } from 'lucide-react';
import { slugify } from '@/lib/utils';

interface LegalPageProps {
  eyebrow: string;
  title: string;
  description: string;
  sections: Array<{ title: string; body: string }>;
  stats?: Array<{ value: string; label: string }>;
  highlights?: Array<{ title: string; body: string }>;
  accent?: 'blue' | 'emerald' | 'violet';
}

const accentMap = {
  blue: {
    pill: 'bg-[rgba(37,99,235,0.1)] text-brand-blue border-brand-blue/15',
    glow: 'from-blue-500/18 via-cyan-500/10 to-transparent',
    dot: 'bg-brand-blue',
    border: 'border-brand-blue/18',
  },
  emerald: {
    pill: 'bg-[rgba(16,185,129,0.12)] text-emerald-600 border-emerald-500/15 dark:text-emerald-300',
    glow: 'from-emerald-500/18 via-teal-500/10 to-transparent',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500/18',
  },
  violet: {
    pill: 'bg-[rgba(139,92,246,0.12)] text-violet-600 border-violet-500/15 dark:text-violet-300',
    glow: 'from-violet-500/18 via-fuchsia-500/10 to-transparent',
    dot: 'bg-violet-500',
    border: 'border-violet-500/18',
  },
} as const;

export function LegalPage({
  eyebrow,
  title,
  description,
  sections,
  stats = [],
  highlights = [],
  accent = 'blue',
}: LegalPageProps) {
  const theme = accentMap[accent];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f7f9fc_0%,#ffffff_40%,#f5f8fd_100%)] px-5 py-10 dark:bg-[linear-gradient(180deg,#050911_0%,#09111c_42%,#050911_100%)] sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute left-[6%] top-24 h-72 w-72 rounded-full bg-gradient-to-br ${theme.glow} blur-[110px]`} />
        <div className="absolute right-[8%] top-[18%] h-60 w-60 rounded-full bg-white/30 blur-[110px] dark:bg-brand-blue/10" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="surface-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:-translate-y-0.5 hover:text-slate-950 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại trang chủ
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="surface-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition hover:-translate-y-0.5 hover:text-slate-950 dark:hover:text-white">
              Đăng nhập
            </Link>
            <Link href="/auth/register" className="btn-kinetic inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_48%,#0ea5e9_100%)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:-translate-y-0.5">
              Bắt đầu
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <section className="surface-panel-strong noise-overlay relative mt-6 overflow-hidden rounded-[2.4rem] p-8 sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.45),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_36%)]" />
          <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div className="max-w-3xl">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] ${theme.pill}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                {eyebrow}
                <Sparkles className="h-3 w-3" />
              </div>

              <h1 className="mt-5 text-[clamp(2.8rem,7vw,5.6rem)] font-black uppercase leading-[0.9] tracking-[-0.07em] text-slate-950 dark:text-white">
                {title}
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-600 dark:text-slate-300">
                {description}
              </p>

              {highlights.length > 0 ? (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {highlights.map((item, index) => (
                    <div key={`${item.title}-${index}`} className={`surface-card rounded-[1.6rem] p-5 ${theme.border}`}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-brand-blue shadow-sm dark:bg-white/[0.06]">
                          <CheckCircle2 className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h2 className="text-sm font-black uppercase tracking-[0.02em] text-slate-900 dark:text-white">
                            {item.title}
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 xl:pl-8">
              <div className="surface-card rounded-[1.8rem] p-5">
                <div className="flex items-center gap-3">
                  <div className="surface-chip flex h-12 w-12 items-center justify-center rounded-2xl">
                    <img src="/logo.gif" alt="TRUNGTAMMMO" className="h-8 w-auto object-contain" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">TRUNGTAMMMO.VN</div>
                    <div className="mt-1 text-lg font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">
                      Tài liệu nền tảng
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-300">
                  Cụm trang này được trình bày lại theo hướng đọc dễ hơn, sạch hơn, nhưng vẫn giữ nội dung gốc migrate từ source PHP cũ.
                </p>
              </div>

              {stats.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {stats.map((stat, index) => (
                    <div key={`${stat.label}-${index}`} className="surface-card rounded-[1.5rem] p-5">
                      <div className="text-2xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">
                        {stat.value}
                      </div>
                      <div className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="surface-panel h-fit rounded-[2rem] p-5 lg:sticky lg:top-6">
            <div className="flex items-center gap-3">
              <div className="surface-chip flex h-10 w-10 items-center justify-center rounded-2xl text-brand-blue">
                <Shield className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mục lục</div>
                <div className="mt-1 text-lg font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">
                  Nội dung chính
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {sections.map((section, index) => {
                const sectionId = slugify(`${index + 1}-${section.title}`);

                return (
                  <a
                    key={`${section.title}-nav-${index}`}
                    href={`#${sectionId}`}
                    className="nav-link-shell nav-link-idle interactive-lift flex items-center justify-between rounded-[1rem] px-4 py-3 text-sm font-bold"
                  >
                    <span className="truncate">
                      <span className="mr-2 font-black text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                      {section.title}
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </a>
                );
              })}
            </div>
          </aside>

          <div className="space-y-5">
            {sections.map((section, index) => {
              const sectionId = slugify(`${index + 1}-${section.title}`);

              return (
                <section
                  id={sectionId}
                  key={`${section.title}-${index}`}
                  className="surface-card scroll-mt-8 rounded-[2rem] p-6 sm:p-7"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-3xl">
                      <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 ${theme.border}`}>
                        Mục {String(index + 1).padStart(2, '0')}
                      </div>
                      <h2 className="mt-4 text-[clamp(1.4rem,3vw,2rem)] font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">
                        {section.title}
                      </h2>
                    </div>
                    <div className="surface-chip inline-flex h-11 min-w-11 items-center justify-center rounded-2xl px-4 text-sm font-black text-slate-500 dark:text-slate-300">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                  </div>

                  <div className="mt-5 h-px bg-gradient-to-r from-slate-200 via-slate-100 to-transparent dark:from-white/10 dark:via-white/5" />
                  <p className="mt-5 whitespace-pre-line text-sm leading-8 text-slate-600 dark:text-slate-300">
                    {section.body}
                  </p>
                </section>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
