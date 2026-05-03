'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Bot,
  Briefcase,
  Cloud,
  CreditCard,
  Gamepad2,
  Headset,
  MessageSquare,
  Package,
  ShoppingCart,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { cn } from '@/lib/utils';

interface HomeServiceCardData {
  key: string;
  title: string;
  desc: string;
  href: string;
  iconKey: string;
  color: string;
  textColor: string;
  maintenance: boolean;
  external: boolean;
  index: number;
}

interface HomeServiceCardProps {
  service: HomeServiceCardData;
  className?: string;
}

const serviceIconMap = {
  'thumbs-up': ThumbsUp,
  zap: Zap,
  package: Package,
  bot: Bot,
  cloud: Cloud,
  headset: Headset,
  'message-square': MessageSquare,
  briefcase: Briefcase,
  'book-open': BookOpen,
  'gamepad-2': Gamepad2,
  'credit-card': CreditCard,
  'shopping-cart': ShoppingCart,
} as const;

export function HomeServiceCard({ service, className }: HomeServiceCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const Icon =
    serviceIconMap[service.iconKey as keyof typeof serviceIconMap] || Package;
  const clickable = !service.maintenance && service.href !== '#';

  function navigateToService() {
    if (!clickable) {
      return;
    }

    if (service.external) {
      window.open(service.href, '_blank', 'noopener,noreferrer');
      return;
    }

    startPageTransition();
    router.push(service.href);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = cardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    node.style.setProperty('--card-rx', `${(0.5 - y) * 14}deg`);
    node.style.setProperty('--card-ry', `${(x - 0.5) * 16}deg`);
    node.style.setProperty('--card-mx', `${x * 100}%`);
    node.style.setProperty('--card-my', `${y * 100}%`);
    node.style.setProperty('--card-tx', `${(x - 0.5) * 18}px`);
    node.style.setProperty('--card-ty', `${(y - 0.5) * 14}px`);
  }

  function handlePointerLeave() {
    const node = cardRef.current;
    if (!node) return;
    node.style.setProperty('--card-rx', '0deg');
    node.style.setProperty('--card-ry', '0deg');
    node.style.setProperty('--card-mx', '50%');
    node.style.setProperty('--card-my', '50%');
    node.style.setProperty('--card-tx', '0px');
    node.style.setProperty('--card-ty', '0px');
  }

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!clickable) {
      return;
    }

    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    navigateToService();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!clickable) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    navigateToService();
  }

  const inner = (
    <>
      {/* Decorative layers — pointer-events: none */}
      <div
        className={`service-tilt-aura bg-gradient-to-br ${service.color}`}
        style={{ pointerEvents: 'none' }}
      />
      <div className="service-tilt-spot" style={{ pointerEvents: 'none' }} />
      <div className="service-tilt-grid" style={{ pointerEvents: 'none' }} />
      <div className="service-tilt-shadow" style={{ pointerEvents: 'none' }} />

      {/* Content */}
      <div
        className="relative flex h-full min-w-0 flex-col p-5 sm:p-7"
        style={{ zIndex: 10, pointerEvents: 'none' }} // ← none vì link/div ngoài handle click
      >
        <div className="mb-8 flex items-start justify-between gap-3 sm:mb-10 sm:gap-4">
          <div className="service-tilt-icon-wrap">
            <div className={`service-tilt-icon bg-gradient-to-br ${service.color}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div
              className={`service-tilt-icon-echo bg-gradient-to-br ${service.color}`}
            />
          </div>
          <div className="service-tilt-top-stack">
            <span className="service-tilt-status">
              {service.maintenance ? 'Offline' : 'Open'}
            </span>
            <span className="service-tilt-number">
              {String(service.index).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="service-tilt-content">
          <h3 className="max-w-full break-words text-lg font-black uppercase leading-[1.14] tracking-[-0.02em] text-slate-950 dark:text-white sm:max-w-[18rem] sm:text-xl">
            {service.title}
          </h3>
          <p className="mt-3 max-w-full text-[11px] font-semibold uppercase leading-[1.85] tracking-[0.08em] text-slate-500 dark:text-white/52 sm:mt-4 sm:max-w-[18rem] sm:text-[12px] sm:leading-[2.05] sm:tracking-[0.16em]">
            {service.desc}
          </p>
        </div>

        <div className="service-tilt-footer mt-auto pt-6 sm:pt-8">
          <div className="flex items-center justify-between border-t border-slate-200/80 pt-5 dark:border-white/10">
            <div className="min-w-0 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-white/32 sm:text-[10px] sm:tracking-[0.3em]">
              {service.external ? 'External service' : 'Enter module'}
            </div>
            <div
              className="inline-flex shrink-0 items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-700 dark:text-white/82 sm:text-[10px] sm:tracking-[0.3em]"
              style={{ transformStyle: 'flat' }}
            >
              Khám phá
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // ✅ stage styles inline — tránh hoàn toàn transform-style: preserve-3d
  const stageStyle: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    borderRadius: 'inherit',
    // Dùng 2D rotate thay vì 3D để không tạo stacking context phức tạp
    transform: 'perspective(1600px) rotateX(var(--card-rx)) rotateY(var(--card-ry))',
    transition: 'transform 240ms cubic-bezier(0.22,1,0.36,1), box-shadow 320ms cubic-bezier(0.22,1,0.36,1)',
    willChange: 'transform',
    // QUAN TRỌNG: không có overflow: hidden để tránh clip link
    overflow: 'visible',
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClickCapture={handleClickCapture}
      onKeyDown={handleKeyDown}
      role={clickable ? 'link' : undefined}
      tabIndex={clickable ? 0 : -1}
      aria-label={service.title}
      aria-disabled={!clickable}
      className={cn(
        'relative z-20 h-full w-full isolate',
        clickable && 'cursor-pointer',
        service.maintenance && 'cursor-not-allowed opacity-60 grayscale',
        className,
      )}
      style={{
        '--card-rx': '0deg',
        '--card-ry': '0deg',
        '--card-mx': '50%',
        '--card-my': '50%',
        '--card-tx': '0px',
        '--card-ty': '0px',
      } as React.CSSProperties}
    >
      {/* Stage với inline style — không dùng .service-tilt-card class để tránh preserve-3d */}
      <div className="service-tilt-stage block" style={stageStyle}>
        {inner}
      </div>
    </div>
  );
}
