// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildPrismaDatasourceUrl() {
  const rawUrl = String(process.env.DATABASE_URL || '').trim();
  if (!rawUrl) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);
    // Using a single dev connection makes concurrent page requests queue up
    // behind each other and slows down SMM/service screens noticeably.
    const defaultDevConnectionLimit = process.env.NODE_ENV === 'production' ? '' : '5';
    const connectionLimit = Number(process.env.PRISMA_CONNECTION_LIMIT || defaultDevConnectionLimit);
    const poolTimeout = Number(process.env.PRISMA_POOL_TIMEOUT || (process.env.NODE_ENV === 'production' ? '' : '20'));

    if (Number.isFinite(connectionLimit) && connectionLimit > 0 && !url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(Math.trunc(connectionLimit)));
    }

    if (Number.isFinite(poolTimeout) && poolTimeout > 0 && !url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(Math.trunc(poolTimeout)));
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

const prismaDatasourceUrl = buildPrismaDatasourceUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: prismaDatasourceUrl
      ? {
        db: {
          url: prismaDatasourceUrl,
        },
      }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
