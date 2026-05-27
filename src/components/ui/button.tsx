import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'btn-kinetic inline-flex items-center justify-center whitespace-nowrap rounded-[0.85rem] text-sm font-black uppercase tracking-[0.12em] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/20 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_48%,#0ea5e9_100%)] text-white shadow-[0_22px_50px_-26px_rgba(37,99,235,0.72)] hover:shadow-[0_28px_58px_-28px_rgba(37,99,235,0.82)]',
        destructive: 'bg-[linear-gradient(135deg,#ef4444_0%,#dc2626_100%)] text-white shadow-[0_22px_50px_-26px_rgba(239,68,68,0.65)] hover:shadow-[0_28px_58px_-28px_rgba(220,38,38,0.8)]',
        outline: 'border border-slate-200/80 bg-white/90 text-slate-900 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.18)] hover:border-brand-blue/20 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]',
        secondary: 'surface-chip text-slate-900 hover:bg-white dark:text-white dark:hover:bg-white/[0.08]',
        ghost: 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white',
        link: 'text-brand-blue underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-6 py-3',
        sm: 'h-9 px-4 py-2 text-[11px]',
        lg: 'h-12 px-8 py-4 text-sm',
        xl: 'h-14 px-10 py-5 text-sm',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        data-loading={loading ? 'true' : undefined}
        disabled={asChild ? undefined : isDisabled}
        {...props}
      >
        <span className="btn-label">
          {loading ? <LoaderCircle className="animate-spin" /> : null}
          {loading && loadingText ? loadingText : children}
        </span>
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
