export const DEFAULT_SMM_PRICE_MULTIPLIER = 1.6;
export const DEFAULT_SMM_MARGIN_PERCENT = 60;
export const MAX_SMM_PRICE_DECIMAL_15_4 = 99999999999.9999;

function roundSmmPrice(value: number) {
  return Math.min(MAX_SMM_PRICE_DECIMAL_15_4, Math.round(Math.max(0, value) * 10000) / 10000);
}

export function normalizeSmmPriceMultiplier(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_SMM_PRICE_MULTIPLIER;
  }

  return Math.max(value, DEFAULT_SMM_PRICE_MULTIPLIER);
}

export function getSmmMarginPercentFromMultiplier(multiplier: number) {
  return Math.max(0, Math.round((normalizeSmmPriceMultiplier(multiplier) - 1) * 10000) / 100);
}

export function buildSmmPriceFromMargin(rate: number, marginPercent = DEFAULT_SMM_MARGIN_PERCENT) {
  return roundSmmPrice(Math.max(0, rate) * (1 + Math.max(0, marginPercent) / 100));
}

export function buildSmmPriceFromMultiplier(rate: number, multiplier = DEFAULT_SMM_PRICE_MULTIPLIER) {
  return roundSmmPrice(Math.max(0, rate) * normalizeSmmPriceMultiplier(multiplier));
}
