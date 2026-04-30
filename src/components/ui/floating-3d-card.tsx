'use client';

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Floating3DCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  floatDelay?: number;
  floatDuration?: number;
  tiltMax?: number;
  tiltPerspective?: number;
  floatDirection?: 'up' | 'down' | 'both';
  enabled?: boolean;
}

export function Floating3DCard({
  children,
  className,
  innerClassName,
  floatDelay = 0,
  floatDuration = 7,
  tiltMax = 8,
  tiltPerspective = 1200,
  floatDirection = 'both',
  enabled = true,
}: Floating3DCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const floatRaf = useRef<number>(0);
  const tiltRaf = useRef<number>(0);
  const currentFloat = useRef({ y: 0, x: 0, rot: 0, phase: 0 });
  const currentTilt = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const targetRX = (my - 0.5) * -tiltMax * 2;
    const targetRY = (mx - 0.5) * tiltMax * 2;

    cancelAnimationFrame(tiltRaf.current);
    const animate = () => {
      currentTilt.current.x += (targetRX - currentTilt.current.x) * 0.1;
      currentTilt.current.y += (targetRY - currentTilt.current.y) * 0.1;

      const glowEl = el.querySelector<HTMLDivElement>('.float-glow');
      if (glowEl) {
        glowEl.style.background = `radial-gradient(circle at ${mx * 100}% ${my * 100}%, rgba(37,99,235,0.12) 0%, transparent 55%)`;
        glowEl.style.opacity = '1';
      }

      const glareEl = el.querySelector<HTMLDivElement>('.float-glare');
      if (glareEl) {
        glareEl.style.transform = `translate(${mx * 100}%, ${my * 100}%) translate(-50%, -50%) rotate(25deg) scale(2.2)`;
        glareEl.style.opacity = '0.35';
      }

      const inner = el.querySelector<HTMLDivElement>('.float-inner');
      if (inner) {
        inner.style.transform = `rotateX(${currentTilt.current.x}deg) rotateY(${currentTilt.current.y}deg) scale3d(1.025,1.025,1.025)`;
      }

      if (Math.abs(targetRX - currentTilt.current.x) > 0.01 || Math.abs(targetRY - currentTilt.current.y) > 0.01) {
        tiltRaf.current = requestAnimationFrame(animate);
      }
    };
    tiltRaf.current = requestAnimationFrame(animate);
  }, [enabled, tiltMax]);

  const handleMouseLeave = useCallback(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    cancelAnimationFrame(tiltRaf.current);
    const animate = () => {
      currentTilt.current.x *= 0.85;
      currentTilt.current.y *= 0.85;

      const inner = el.querySelector<HTMLDivElement>('.float-inner');
      if (inner) {
        inner.style.transform = `rotateX(${currentTilt.current.x}deg) rotateY(${currentTilt.current.y}deg) scale3d(1,1,1)`;
      }

      const glareEl = el.querySelector<HTMLDivElement>('.float-glare');
      if (glareEl) {
        glareEl.style.opacity = '0';
      }

      const glowEl = el.querySelector<HTMLDivElement>('.float-glow');
      if (glowEl) {
        glowEl.style.opacity = '0';
      }

      if (Math.abs(currentTilt.current.x) > 0.01 || Math.abs(currentTilt.current.y) > 0.01) {
        tiltRaf.current = requestAnimationFrame(animate);
      }
    };
    tiltRaf.current = requestAnimationFrame(animate);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(tiltRaf.current);
      cancelAnimationFrame(floatRaf.current);
    };
  }, [handleMouseLeave, handleMouseMove, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const startTime = performance.now() + floatDelay * 1000;

      const animate = (time: number) => {
        const elapsed = (time - startTime) / 1000;
        if (elapsed < 0) {
          floatRaf.current = requestAnimationFrame(animate);
          return;
        }

        if (floatDuration > 0) {
          const progress = elapsed % floatDuration;
          const half = floatDuration / 2;
          const y = floatDirection === 'up'
            ? -1
            : floatDirection === 'down'
            ? 1
            : Math.sin((progress / half) * Math.PI) * 2 - 1;
          const x = floatDirection === 'both'
            ? Math.sin((progress / floatDuration) * Math.PI * 2) * 0.7
            : 0;
          const rot = Math.sin((progress / floatDuration) * Math.PI * 2) * 1.0;

          currentFloat.current = { y, x, rot, phase: progress };

          const rootEl = containerRef.current;
          if (rootEl) {
            const stageEl = rootEl.querySelector<HTMLDivElement>('.float-stage');
            if (stageEl) {
              stageEl.style.transform = `translateY(${y}px) translateX(${x}px) rotate(${rot}deg)`;
            }
          }
        }

        floatRaf.current = requestAnimationFrame(animate);
      };

    floatRaf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(floatRaf.current);
  }, [enabled, floatDelay, floatDuration, floatDirection]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative block h-full',
        enabled && 'transition-transform',
        className
      )}
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="float-stage h-full">
        {/* Glow backdrop */}
        <div className="float-glow pointer-events-none absolute inset-0 z-0 rounded-[1.4rem] opacity-0 transition-opacity duration-300" />

        {/* Glare overlay */}
        <div
          className="float-glare pointer-events-none absolute inset-0 z-30 rounded-[1.4rem] bg-gradient-to-br from-white/60 via-white/20 to-transparent opacity-0 transition-opacity duration-200"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3) 0%, transparent 55%)' }}
        />

        {/* Tilt container */}
        <div
          className={cn('float-inner relative z-20 h-full', innerClassName)}
          style={{
            transformStyle: 'preserve-3d',
            transition: enabled ? 'transform 0.15s ease-out' : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
