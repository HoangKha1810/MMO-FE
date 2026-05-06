import { toNumber } from '@/lib/utils';

export const MAX_RESOURCE_PRICE = 9_999_999_999_999.99;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function chooseStep(seed: string, min: number, max: number, step = 1000) {
  const steps = Math.max(1, Math.floor((max - min) / step) + 1);
  return min + (stableHash(seed) % steps) * step;
}

export function clampResourcePrice(value: unknown) {
  const amount = Math.max(0, toNumber(value, 0));
  if (!Number.isFinite(amount)) return 0;
  return Math.min(Math.round(amount * 100) / 100, MAX_RESOURCE_PRICE);
}

export function getGameAccountApiMarkup(costInput: unknown, seedInput: unknown = '') {
  const cost = Math.max(0, toNumber(costInput, 0));
  const seed = String(seedInput || cost);

  if (cost < 20_000) return chooseStep(seed, 5_000, 10_000);
  if (cost < 50_000) return chooseStep(seed, 10_000, 20_000);
  if (cost < 100_000) return chooseStep(seed, 20_000, 30_000);
  if (cost < 200_000) return 30_000;
  if (cost < 1_000_000) return 50_000;
  return chooseStep(seed, 200_000, 500_000, 10_000);
}

export function calculateGameAccountApiPrice(costInput: unknown, seedInput: unknown = '') {
  const cost = clampResourcePrice(costInput);
  const markup = getGameAccountApiMarkup(cost, seedInput);
  return clampResourcePrice(cost + markup);
}
