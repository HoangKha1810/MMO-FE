'use client';

import Link from 'next/link';
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

function resetCard(node: HTMLDivElement) {
  node.style.setProperty('--card-rx', '0deg');
  node.style.setProperty('--card-ry', '0deg');
  node.style.setProperty('--card-mx', '50%');
  node.style.setProperty('--card-my', '50%');
  node.style.setProperty('--card-tx', '0px');
  node.style.setProperty('--card-ty', '0px');
}

export function HomeServiceCard({ service, className }: HomeServiceCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const Icon = serviceIconMap[service.iconKey as keyof typeof serviceIconMap] || Package;
  const clickable = !service.maintenance && service.href !== '#';

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = cardRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 16;
    const rotateX = (0.5 - y) * 14;

    node.style.setProperty('--card-rx', `${rotateX}deg`);
    node.style.setProperty('--card-ry', `${rotateY}deg`);
    node.style.setProperty('--card-mx', `${x * 100}%`);
    node.style.setProperty('--card-my', `${y * 100}%`);
    node.style.setProperty('--card-tx', `${(x - 0.5) * 18}px`);
    node.style.setProperty('--card-ty', `${(y - 0.5) * 14}px`);
  }

  function handlePointerLeave() {
    if (!cardRef.current) return;
    resetCard(cardRef.current);
  }

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        'service-tilt-card',
        service.maintenance && 'cursor-not-allowed grayscale opacity-60',
        className
      )}
    >
      <div className="service-tilt-stage">
        <div className={`service-tilt-aura bg-gradient-to-br ${service.color}`} />
        <div className="service-tilt-spot" />
        <div className="service-tilt-grid" />
        <div className="service-tilt-shadow" />

        <div className="relative z-10 flex h-full flex-col p-6 sm:p-7">
          <div className="mb-10 flex items-start justify-between gap-4">
            <div className="service-tilt-icon-wrap">
              <div className={`service-tilt-icon bg-gradient-to-br ${service.color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className={`service-tilt-icon-echo bg-gradient-to-br ${service.color}`} />
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
            <h3 className="max-w-[18rem] text-xl font-black uppercase leading-[1.14] tracking-[-0.02em] text-slate-950 dark:text-white">
              {service.title}
            </h3>
            <p className="mt-4 max-w-[18rem] text-[12px] font-semibold uppercase tracking-[0.16em] leading-[2.05] text-slate-500 dark:text-white/52">
              {service.desc}
            </p>
          </div>

          <div className="service-tilt-footer mt-auto pt-8">
            <div className="flex items-center justify-between border-t border-slate-200/80 pt-5 dark:border-white/10">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-white/32">
                {service.external ? 'External service' : 'Enter module'}
              </div>
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-700 dark:text-white/82">
                Khám phá
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>

        {clickable ? (
          service.external ? (
            <a
              href={service.href}
              target="_blank"
              rel="noreferrer"
              className="absolute inset-0 z-20 rounded-[inherit]"
              aria-label={service.title}
            />
          ) : (
            <Link
              href={service.href}
              className="absolute inset-0 z-20 rounded-[inherit]"
              aria-label={service.title}
              onClick={() => startPageTransition()}
            />
          )
        ) : null}
      </div>
    </div>
  );
}
