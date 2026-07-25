import { BLUE_TICK_BADGE_SRC } from '@/lib/blue-tick-constants';
import { cn } from '@/lib/utils';

export function isBlueTickActiveValue(isBlueTick: unknown, expiry?: unknown) {
  const active =
    isBlueTick === true ||
    isBlueTick === 1 ||
    String(isBlueTick).trim().toLowerCase() === 'true' ||
    String(isBlueTick).trim() === '1';

  if (!active) {
    return false;
  }

  if (!expiry) {
    return true;
  }

  const expiryDate = expiry instanceof Date ? expiry : new Date(String(expiry));
  return Number.isFinite(expiryDate.getTime()) && expiryDate.getTime() > Date.now();
}

export function BlueTickBadge({
  active = true,
  expiry,
  className,
}: {
  active?: unknown;
  expiry?: unknown;
  className?: string;
}) {
  if (!isBlueTickActiveValue(active, expiry)) {
    return null;
  }

  return (
    <img
      src={BLUE_TICK_BADGE_SRC}
      alt="Tick xanh"
      title="Tick xanh"
      className={cn('pointer-events-none shrink-0 select-none object-contain drop-shadow-[0_8px_16px_rgba(56,189,248,0.42)]', className)}
      draggable={false}
    />
  );
}
