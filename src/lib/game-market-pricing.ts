export const GAME_MARKET_PLATFORM_FEE = 100_000;

export function normalizeGameMarketSellerPrice(price: number) {
  return Math.max(1000, Math.round(Number.isFinite(price) ? price : 0));
}

export function getGameMarketListedPrice(sellerPrice: number) {
  return normalizeGameMarketSellerPrice(sellerPrice) + GAME_MARKET_PLATFORM_FEE;
}
