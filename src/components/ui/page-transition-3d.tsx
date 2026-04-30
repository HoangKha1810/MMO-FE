'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PageTransition3DProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'cube' | 'flip' | 'slide';
  direction?: 'left' | 'right';
}

const variantClasses = {
  cube: 'perspective-[2000px]',
  flip: 'perspective-[1800px]',
  slide: '',
};

export function PageTransition3D({
  children,
  className,
  variant = 'flip',
}: PageTransition3DProps) {
  const [phase, setPhase] = useState<'idle' | 'entering' | 'visible' | 'leaving'>('entering');
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => setPhase('visible'), 50);
    return () => clearTimeout(timer);
  }, [mounted]);

  const baseStyle: React.CSSProperties = {
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden',
  };

  const enterStyle: React.CSSProperties = {
    ...baseStyle,
    animation: 'pageFlipEnter 0.55s cubic-bezier(0.65, 0, 0.35, 1) forwards',
  };

  const visibleStyle: React.CSSProperties = {
    ...baseStyle,
    transform: 'rotateX(0deg) translateZ(0px)',
    opacity: 1,
  };

  if (!mounted) return <div className={className}>{children}</div>;

  return (
    <div className={cn(variantClasses[variant], 'origin-center', className)}>
      <div
        ref={ref}
        style={phase === 'entering' ? enterStyle : phase === 'visible' ? visibleStyle : undefined}
        className={cn(
          phase === 'visible' && 'animate-page-visible',
        )}
      >
        {children}
      </div>

      <style>{`
        @keyframes pageFlipEnter {
          0% {
            opacity: 0;
            transform: rotateX(-8deg) translateY(24px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: rotateX(0deg) translateY(0px) scale(1);
          }
        }
        .animate-page-visible {
          animation: pageVisiblePulse 0.3s ease-out forwards;
        }
        @keyframes pageVisiblePulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.008); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
