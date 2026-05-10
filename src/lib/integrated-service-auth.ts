import { cookies, headers } from 'next/headers';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';

type MmoUser = {
  id: number;
  username: string;
  email: string;
  fullname: string | null;
  role: string | null;
  status: string | null;
  balance: unknown;
  rank: string | null;
  email_verified: boolean | null;
  fa_enabled: boolean | null;
  avatar: string | null;
  ai_plan_name?: string | null;
  created_at?: Date | string | null;
};

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signHs256Jwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64Url(signature)}`;
}

function hashAiSessionToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

async function getLoggedInUser() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return null;
  }

  const user = await db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      fullname: true,
      role: true,
      status: true,
      balance: true,
      rank: true,
      email_verified: true,
      fa_enabled: true,
      avatar: true,
      ai_plan_name: true,
      created_at: true,
    },
  });

  if (!user || user.status !== 'active') {
    return null;
  }

  return user as MmoUser;
}

export async function createIntegratedVpsSession() {
  const user = await getLoggedInUser();
  if (!user) {
    return null;
  }

  const secret = String(process.env.INTEGRATED_VPS_JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('Thiếu INTEGRATED_VPS_JWT_SECRET');
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signHs256Jwt(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role || 'member',
      status: user.status || 'active',
      balance: toNumber(user.balance, 0),
      rank: user.rank || 'Member',
      email_verified: user.email_verified ? 1 : 0,
      two_factor_enabled: user.fa_enabled ? 1 : 0,
      avatar: buildLegacyAssetUrl(user.avatar),
      iat: now,
      exp: now + 7 * 24 * 60 * 60,
    },
    secret
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role || 'member',
      status: user.status || 'active',
      balance: toNumber(user.balance, 0),
      rank: user.rank || 'Member',
      email_verified: user.email_verified ? 1 : 0,
      two_factor_enabled: user.fa_enabled ? 1 : 0,
      avatar: buildLegacyAssetUrl(user.avatar),
    },
  };
}

export async function createIntegratedAiSession() {
  const user = await getLoggedInUser();
  if (!user) {
    return null;
  }

  const rawToken = randomBytes(36).toString('base64url');
  const tokenHash = hashAiSessionToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const headerStore = await headers();
  const ipAddress = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = headerStore.get('user-agent') || null;

  await db.$executeRawUnsafe(
    `
      INSERT INTO ai_user_sessions (user_id, token_hash, ip_address, user_agent, created_at, last_used_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    user.id,
    tokenHash,
    ipAddress,
    userAgent,
    now,
    now,
    expiresAt
  );

  return {
    token: rawToken,
    user: {
      id: String(user.id),
      email: user.email,
      displayName: String(user.fullname || user.username || user.email),
      username: user.username,
      role: user.role || 'member',
      balance: toNumber(user.balance, 0),
      currentPlanName: user.ai_plan_name || 'Free',
      currentPlanIsPaid: Boolean(user.ai_plan_name && String(user.ai_plan_name).toLowerCase() !== 'free'),
      avatarUrl: buildLegacyAssetUrl(user.avatar),
      createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at || now.toISOString()),
    },
  };
}
