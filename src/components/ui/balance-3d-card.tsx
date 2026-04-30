'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Balance3DCardProps {
  balance: number;
  className?: string;
}

export function Balance3DCard({ balance, className }: Balance3DCardProps) {
  const { resolvedTheme } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);
  const rafRef = useRef<number>(0);
  const current = useRef({ tiltX: 0, tiltY: 0 });
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    };

    el.addEventListener('mousemove', handleMouseMove);
    return () => el.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const animate = () => {
      const targetX = isHovered ? (mousePos.x - 0.5) * -14 : 0;
      const targetY = isHovered ? (mousePos.y - 0.5) * 10 : 0;

      current.current.tiltX += (targetX - current.current.tiltX) * 0.08;
      current.current.tiltY += (targetY - current.current.tiltY) * 0.08;

      el.style.transform = `
        perspective(900px)
        rotateX(${current.current.tiltY}deg)
        rotateY(${current.current.tiltX}deg)
        ${isHovered ? 'scale3d(1.03, 1.03, 1.03)' : 'scale3d(1, 1, 1)'}
      `;

      const glareEl = el.querySelector<HTMLDivElement>('.card-glare');
      if (glareEl) {
        glareEl.style.background = `
          radial-gradient(
            circle at ${mousePos.x * 100}% ${mousePos.y * 100}%,
            ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.45)'} 0%,
            transparent 55%
          )
        `;
      }

      const shadowEl = el.querySelector<HTMLDivElement>('.card-shadow');
      if (shadowEl) {
        const shadowX = (mousePos.x - 0.5) * -20;
        const shadowY = (mousePos.y - 0.5) * 20;
        shadowEl.style.boxShadow = `
          ${shadowX}px ${shadowY + 16}px 48px -12px
          ${isDark ? 'rgba(37,99,235,0.35)' : 'rgba(37,99,235,0.25)'}
        `;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isHovered, mousePos, isDark]);

  const formattedBalance = new Intl.NumberFormat('vi-VN').format(balance);

  return (
    <div
      ref={cardRef}
      className={cn(
        'group relative cursor-pointer select-none rounded-[1.35rem] border border-brand-blue/20 bg-gradient-to-br from-brand-blue/8 via-white/60 to-brand-blue/5 p-5 transition-shadow duration-300',
        'dark:border-brand-blue/30 dark:from-brand-blue/15 dark:via-slate-900/80 dark:to-brand-blue/8',
        'shadow-lg shadow-brand-blue/10',
        className
      )}
      style={{
        transition: 'transform 0.1s ease-out',
        transformStyle: 'preserve-3d',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glare overlay */}
      <div className="card-glare pointer-events-none absolute inset-0 z-10 rounded-[1.35rem] transition-opacity duration-200" />

      {/* Inner glow */}
      <div
        className="pointer-events-none absolute -inset-px z-0 rounded-[1.35rem] opacity-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at 60% 30%, ${isDark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.12)'} 0%, transparent 60%)`,
          opacity: isHovered ? 1 : 0,
        }}
      />

      {/* Shadow container */}
      <div className="card-shadow relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-blue/20 bg-brand-blue/10 text-brand-blue shadow-sm shadow-brand-blue/20">
            <Wallet className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-white/35">
              Số Dư Khả Dụng
            </div>
            <div className="mt-1 font-mono text-[1.35rem] font-black tracking-[-0.04em] text-brand-blue dark:text-brand-blue">
              {formattedBalance}
              <span className="ml-1 text-[0.7em] font-black uppercase tracking-tight text-brand-blue/70">đ</span>
            </div>
          </div>
        </div>

        {/* Shimmer line */}
        <div
          className="mt-4 h-0.5 w-full overflow-hidden rounded-full"
          style={{
            background: isDark
              ? 'linear-gradient(90deg, transparent, rgba(37,99,235,0.4), rgba(96,165,250,0.6), rgba(37,99,235,0.4), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(37,99,235,0.2), rgba(96,165,250,0.3), rgba(37,99,235,0.2), transparent)',
          }}
        >
          <div
            className={cn(
              'h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent',
              'transition-transform duration-500',
              isHovered ? 'translate-x-full' : '-translate-x-full'
            )}
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500/80">
            Trực tuyến
          </span>
        </div>
      </div>
    </div>
  );
}
