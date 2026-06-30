import { headers } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
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

function hashAiSessionToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

async function getLoggedInUser() {
  const userId = await getVerifiedSessionUserId();

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
