import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'field-elevated flex h-11 w-full rounded-[1rem] px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 transition-all dark:text-white',
          'focus:outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
