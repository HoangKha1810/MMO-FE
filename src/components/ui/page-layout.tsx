import * as React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AccentTone = 'blue' | 'emerald' | 'amber' | 'violet' | 'slate';

const toneMap: Record<AccentTone, string> = {
  blue: 'text-brand-blue border-brand-blue/20 bg-brand-blue/10',
  emerald: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
  amber: 'text-amber-500 border-amber-500/20 bg-amber-500/10',
  violet: 'text-violet-500 border-violet-500/20 bg-violet-500/10',
  slate: 'text-slate-500 border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
};

export interface HeroStat {
  label: string;
  value: string;
  hint?: string;
  tone?: AccentTone;
}

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  stats?: HeroStat[];
  children?: React.ReactNode;
  className?: string;
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  stats = [],
  children,
  className,
}: PageHeroProps) {
  return (
    <section className={cn('surface-panel-strong relative overflow-hidden rounded-[2rem] p-6 md:p-8', className)}>
      <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-brand-blue/10 blur-3xl dark:bg-brand-blue/15" />
      <div className="pointer-events-none absolute -right-8 bottom-0 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/15" />
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-brand-blue via-emerald-500/50 to-transparent" />

      <div className={cn('relative grid gap-6', stats.length > 0 || children ? 'xl:grid-cols-[minmax(0,1.25fr)_360px]' : '')}>
        <div className="space-y-5">
          {eyebrow ? (
            <Badge variant="muted" className="w-fit rounded-full px-3 py-1.5 text-[9px] tracking-[0.3em]">
              <Sparkles className="h-3 w-3" />
              {eyebrow}
            </Badge>
          ) : null}
          <div className="space-y-3">
            <h1 className="max-w-4xl text-3xl font-black uppercase leading-[1.06] tracking-[-0.03em] text-slate-950 dark:text-white md:text-4xl xl:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm font-medium leading-[2] tracking-[0.02em] text-slate-600 dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          {children}
        </div>

        {stats.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            {stats.map((stat) => (
              <Card key={`${stat.label}-${stat.value}`} className="rounded-[1.5rem] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                      {stat.label}
                    </div>
                    <div className="font-mono text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">
                      {stat.value}
                    </div>
                    {stat.hint ? (
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{stat.hint}</p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em]',
                      toneMap[stat.tone || 'slate']
                    )}
                  >
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
            {eyebrow}
          </div>
        ) : null}
        <div>
          <h2 className="text-2xl font-black uppercase leading-[1.08] tracking-[-0.028em] text-slate-950 dark:text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm font-medium leading-[1.95] tracking-[0.02em] text-slate-600 dark:text-slate-300">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionPanel({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('surface-panel rounded-[1.8rem] p-5 md:p-6', className)}>
      {children}
    </section>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: AccentTone;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, hint, tone = 'slate', icon, className }: MetricCardProps) {
  return (
    <Card className={cn('rounded-[1.6rem] p-5 md:p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
            {label}
          </div>
          <div className="font-mono text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">
            {value}
          </div>
          {hint ? (
            <p className="text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{hint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-2xl border',
            toneMap[tone]
          )}
        >
          {icon || <ArrowUpRight className="h-4 w-4" />}
        </span>
      </div>
    </Card>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'surface-panel flex flex-col items-center justify-center rounded-[1.8rem] border-dashed px-6 py-14 text-center',
        className
      )}
    >
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[1.4rem] border border-slate-200 bg-white/80 text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
        {icon || <Sparkles className="h-5 w-5" />}
      </span>
      <h3 className="text-lg font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}
