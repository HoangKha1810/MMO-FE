'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  hue: number;
  depth: number;
}

interface ParticleBackgroundProps {
  className?: string;
  particleCount?: number;
  colorBlue?: number;
  colorEmerald?: number;
}

export function ParticleBackground({
  className,
  particleCount = 60,
  colorBlue = 220,
  colorEmerald = 160,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const init = () => {
      particlesRef.current = Array.from({ length: particleCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.5 + 0.5,
        speedX: (Math.random() - 0.5) * 0.25,
        speedY: (Math.random() - 0.5) * 0.25,
        opacity: Math.random() * 0.5 + 0.1,
        hue: Math.random() > 0.5 ? colorBlue : colorEmerald,
        depth: Math.random(),
      }));
    };
    init();

    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        ctx.save();
        ctx.globalAlpha = p.opacity * (0.3 + p.depth * 0.7);
        ctx.shadowBlur = 8 + p.depth * 12;
        ctx.shadowColor = `hsl(${p.hue}, 90%, 60%)`;
        ctx.fillStyle = `hsl(${p.hue}, 80%, ${50 + p.depth * 30}%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + p.depth * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const a = particlesRef.current[i];
          const b = particlesRef.current[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 120 + (a.depth + b.depth) * 40;

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.15 * ((a.depth + b.depth) / 2);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = `hsl(${220}, 70%, 60%)`;
            ctx.lineWidth = 0.5;
            ctx.shadowBlur = 3;
            ctx.shadowColor = `hsl(220, 70%, 60%)`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, [mounted, particleCount, colorBlue, colorEmerald]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'pointer-events-none absolute inset-0 z-0 h-full w-full opacity-60',
        className
      )}
    />
  );
}
