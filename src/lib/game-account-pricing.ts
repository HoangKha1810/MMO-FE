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

function parseMoneyToken(rawAmount: string, suffix: string) {
  const unit = suffix.toLowerCase();
  const amount = rawAmount.trim();
  const hasDecimalSeparator = /^[0-9]+[,.][0-9]{1,2}$/.test(amount);
  const numeric = hasDecimalSeparator
    ? Number(amount.replace(',', '.'))
    : Number(amount.replace(/[.,]/g, ''));

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (unit === 'k') {
    return numeric * 1000;
  }

  if (unit === 'tr' || unit === 'trieu' || unit === 'triệu') {
    return numeric * 1_000_000;
  }

  return numeric;
}

function formatCompactAmount(value: number, divisor: number) {
  const amount = value / divisor;
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded)
    ? new Intl.NumberFormat('vi-VN').format(rounded)
    : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(rounded);
}

function formatReplacementPrice(displayPriceInput: unknown, suffix: string) {
  const displayPrice = clampResourcePrice(displayPriceInput);
  const unit = suffix.toLowerCase();

  if (unit === 'k') {
    return `${formatCompactAmount(displayPrice, 1000)}${suffix === 'K' ? 'K' : 'k'}`;
  }

  if (unit === 'tr' || unit === 'trieu' || unit === 'triệu') {
    return `${formatCompactAmount(displayPrice, 1_000_000)}${suffix}`;
  }

  return `${new Intl.NumberFormat('vi-VN').format(Math.round(displayPrice))}đ`;
}

function isSameMoneyValue(left: number, right: number) {
  if (left <= 0 || right <= 0) {
    return false;
  }

  return Math.abs(left - right) <= Math.max(1000, right * 0.015);
}

export function rewriteGameAccountPriceMentions(
  value: unknown,
  input: { sourcePrice?: unknown; displayPrice?: unknown }
) {
  const sourcePrice = clampResourcePrice(input.sourcePrice);
  const displayPrice = clampResourcePrice(input.displayPrice);
  const text = String(value || '');

  if (!text || sourcePrice <= 0 || displayPrice <= 0 || isSameMoneyValue(sourcePrice, displayPrice)) {
    return text;
  }

  return text.replace(
    /(^|[^\p{L}\p{N}])(\d+(?:[.,]\d+)*)(\s*)(k|K|đ|d|vnd|vnđ|tr|trieu|triệu)(?![\p{L}\p{N}])/giu,
    (match, prefix: string, amount: string, spacing: string, suffix: string) => {
      const tokenPrice = parseMoneyToken(amount, suffix);

      if (!isSameMoneyValue(tokenPrice, sourcePrice)) {
        return match;
      }

      return `${prefix}${formatReplacementPrice(displayPrice, suffix)}${spacing && /^[\t ]+$/.test(spacing) ? '' : ''}`;
    }
  );
}
