import 'server-only';

import { db } from '@/lib/db';

let supportedGameMarketItemStatusesPromise: Promise<Set<string>> | null = null;

function parseEnumValues(columnType: string) {
  return Array.from(columnType.matchAll(/'([^']+)'/g)).map((match) => match[1]);
}

async function getSupportedGameMarketItemStatuses() {
  if (!supportedGameMarketItemStatusesPromise) {
    supportedGameMarketItemStatusesPromise = (async () => {
      const rows = await db.$queryRawUnsafe<Array<{ COLUMN_TYPE?: string }>>(
        `
          SELECT COLUMN_TYPE
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'game_market_items'
            AND COLUMN_NAME = 'status'
          LIMIT 1
        `
      );

      return new Set(parseEnumValues(String(rows[0]?.COLUMN_TYPE || '')));
    })().catch((error) => {
      supportedGameMarketItemStatusesPromise = null;
      throw error;
    });
  }

  return supportedGameMarketItemStatusesPromise;
}

export async function getGameMarketPendingLikeStatus() {
  const statuses = await getSupportedGameMarketItemStatuses();
  if (statuses.has('pending')) {
    return 'pending';
  }
  if (statuses.has('hidden')) {
    return 'hidden';
  }
  return 'selling';
}

export async function getGameMarketRejectedLikeStatus() {
  const statuses = await getSupportedGameMarketItemStatuses();
  if (statuses.has('rejected')) {
    return 'rejected';
  }
  if (statuses.has('hidden')) {
    return 'hidden';
  }
  return 'sold';
}
