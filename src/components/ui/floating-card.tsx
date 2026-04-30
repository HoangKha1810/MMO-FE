'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface FloatingCardProps {
  children: React.ReactNode;
  className?: string;
  floatDelay?: number;
  floatDuration?: number;
  floatDirection?: 'up' | 'down' | 'both';
}

export function FloatingCard({
  children,
  className,
  floatDelay = 0,
  floatDuration = 6,
  floatDirection = 'both',
}: FloatingCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame: number;
    const startTime = performance.now() + floatDelay * 1000;

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      if (elapsed < 0) {
        frame = requestAnimationFrame(animate);
        return;
      }

      const progress = elapsed % floatDuration;
      const half = floatDuration / 2;
      const y = floatDirection === 'up'
        ? -1
        : floatDirection === 'down'
        ? 1
        : Math.sin((progress / half) * Math.PI) * 2 - 1;
      const x = floatDirection === 'both'
        ? Math.sin((progress / floatDuration) * Math.PI * 2) * 0.6
        : 0;
      const rotate = Math.sin((progress / floatDuration) * Math.PI * 2) * 1.2;

      el.style.transform = `translateY(${y}px) translateX(${x}px) rotate(${rotate}deg)`;
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [floatDelay, floatDuration, floatDirection]);

  return (
    <div ref={ref} className={cn('transition-transform', className)}>
      {children}
    </div>
  );
}
