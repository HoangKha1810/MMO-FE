import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm',
  {
    variants: {
      variant: {
        default: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
        success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        danger: 'bg-red-500/10 text-red-600 border-red-500/20',
        info: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        muted: 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10',
        purple: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        orange: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
