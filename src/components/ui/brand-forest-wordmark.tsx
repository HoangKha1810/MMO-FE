import { cn } from '@/lib/utils';

interface BrandForestWordmarkProps {
  text?: string;
  className?: string;
  letterClassName?: string;
}

export function BrandForestWordmark({
  text = 'TRUNGTAMMMO',
  className,
  letterClassName,
}: BrandForestWordmarkProps) {
  const normalizedText = String(text || 'TRUNGTAMMMO').replace(/\.vn$/i, '').toUpperCase();

  return (
    <span
      aria-label={normalizedText}
      className={cn(
        'brand-forest-wordmark relative z-[1] inline-flex shrink-0 items-center gap-[0.045em] whitespace-nowrap align-middle font-black uppercase leading-none tracking-[0.08em] text-inherit',
        className
      )}
    >
      {Array.from(normalizedText).map((char, index) =>
        char === ' ' ? (
          <span key={`space-${index}`} aria-hidden="true" className="w-[0.34em] shrink-0" />
        ) : (
          <span
            key={`${char}-${index}`}
            aria-hidden="true"
            className={cn('brand-forest-letter', letterClassName)}
          >
            <span className="brand-forest-layer brand-forest-layer-stroke">{char}</span>
            <span className="brand-forest-layer brand-forest-layer-fill">{char}</span>
          </span>
        )
      )}
    </span>
  );
}
