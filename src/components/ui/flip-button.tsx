import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type FlipButtonSize = 'sm' | 'default' | 'lg';

type FlipButtonLinkProps = {
  href: string;
  size?: FlipButtonSize;
  className?: string;
  stageClassName?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'className' | 'children'>;

type FlipButtonActionProps = {
  href?: undefined;
  size?: FlipButtonSize;
  className?: string;
  stageClassName?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

type FlipButtonProps = FlipButtonLinkProps | FlipButtonActionProps;

const sizeMap: Record<FlipButtonSize, string> = {
  sm: 'h-12 min-w-[10.5rem] text-[0.74rem]',
  default: 'h-14 min-w-[12rem] text-[0.78rem]',
  lg: 'h-[3.95rem] min-w-[13.5rem] text-[0.82rem]',
};

function FlipButton({
  size = 'default',
  className,
  stageClassName,
  children,
  ...props
}: FlipButtonProps) {
  const surface = (
    <span className={cn('btn-3d-shell', sizeMap[size], stageClassName)}>
      <span className="btn-3d-shadow" />
      <span className="btn-3d-surface">
        <span className="btn-3d-highlight" />
        <span className="btn-3d-content">{children}</span>
      </span>
    </span>
  );

  const sharedClassName = cn(
    'btn-3d group relative inline-flex align-top no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/20 disabled:pointer-events-none disabled:opacity-60',
    className
  );

  if ('href' in props && typeof props.href === 'string') {
    const { href, ...linkProps } = props;

    return (
      <Link href={href} className={sharedClassName} {...linkProps}>
        {surface}
      </Link>
    );
  }

  const { type = 'button', disabled, ...buttonProps } = props;

  return (
    <button type={type} disabled={disabled} className={sharedClassName} {...buttonProps}>
      {surface}
    </button>
  );
}

export { FlipButton };
