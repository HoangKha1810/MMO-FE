'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface TiltOptions {
  maxTilt?: number;
  perspective?: number;
  glareEnabled?: boolean;
  glareColor?: string;
  glareOpacity?: number;
  speed?: number;
  resetTransitionDuration?: number;
}

interface UseMouseTiltOptions extends TiltOptions {
  enabled?: boolean;
}

export function useMouseTilt<T extends HTMLElement = HTMLDivElement>({
  maxTilt = 12,
  perspective = 1200,
  glareEnabled = true,
  glareColor = 'rgba(255,255,255,0.12)',
  glareOpacity = 1,
  speed = 400,
  resetTransitionDuration = 400,
  enabled = true,
}: UseMouseTiltOptions = {}) {
  const ref = useRef<T>(null);
  const [transform, setTransform] = useState('');
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({});
  const rafRef = useRef<number>(0);
  const target = useRef({ x: 0, y: 0, rx: 0, ry: 0 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;

      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;

      const rotateX = ((y / h) - 0.5) * -maxTilt * 2;
      const rotateY = ((x / w) - 0.5) * maxTilt * 2;

      target.current = { x, y, rx: rotateX, ry: rotateY };

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!el) return;
        const style = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.04,1.04,1.04)`;
        setTransform(style);

        if (glareEnabled) {
          setGlareStyle({
            backgroundImage: `linear-gradient(135deg, ${glareColor} 0%, transparent 60%)`,
            opacity: glareOpacity,
            transform: `translate(${x - w / 2}px, ${y - h / 2}px) rotate(25deg) translate(-50%, -50%)`,
            width: `${w}px`,
            height: `${h}px`,
          });
        }
      });
    },
    [enabled, glareColor, glareEnabled, glareOpacity, maxTilt, perspective]
  );

  const handleMouseLeave = useCallback(() => {
    if (!enabled) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTransform(
        `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)`
      );
      setGlareStyle({});
    });
    target.current = { x: 0, y: 0, rx: 0, ry: 0 };
  }, [enabled, perspective]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    el.addEventListener('mousemove', handleMouseMove as EventListener);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove as EventListener);
      el.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseLeave, handleMouseMove, enabled]);

  return {
    ref,
    transform,
    glareStyle,
    transitionStyle: { transition: `transform ${speed}ms cubic-bezier(0.03,0.98,0.52,0.99), opacity ${resetTransitionDuration}ms ease` },
  };
}

interface Tilt3DProps extends TiltOptions {
  children: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
}

export function Tilt3D({
  children,
  className,
  wrapperClassName,
  maxTilt = 10,
  perspective = 1000,
  glareEnabled = true,
  glareColor = 'rgba(255,255,255,0.18)',
  glareOpacity = 0.9,
  speed = 400,
  resetTransitionDuration = 400,
}: Tilt3DProps) {
  const { ref, transform, glareStyle, transitionStyle } = useMouseTilt({
    maxTilt,
    perspective,
    glareEnabled,
    glareColor,
    glareOpacity,
    speed,
    resetTransitionDuration,
  });

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[1.4rem]',
        wrapperClassName
      )}
      style={{ transform: 'translateZ(0)' }}
    >
      <div
        ref={ref}
        className={cn('relative', className)}
        style={{ ...transitionStyle }}
      >
        {children}
        {glareEnabled && (
          <div
            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300"
            style={{
              ...glareStyle,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: 'cover',
              opacity: glareStyle.opacity as number > 0 ? 0.6 : 0,
            }}
          />
        )}
      </div>
    </div>
  );
}
