import { redirect } from 'next/navigation';
import { buildAccessPageUrl } from '@/lib/access-page';
import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { toNumber } from '@/lib/utils';

export async function getCurrentUserForShell() {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    redirect(buildAccessPageUrl({
      reason: 'login-required',
      area: 'user',
      next: '/user/home',
    }));
  }

  const user = await db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      fullname: true,
      avatar: true,
      balance: true,
      game_balance: true,
      rank: true,
      role: true,
      status: true,
      is_blue_tick: true,
      created_at: true,
      last_login: true,
      bio: true,
      occupation: true,
      expertise_tags: true,
      hometown: true,
      contact: true,
      telegram_username: true,
      birthday: true,
      gender: true,
    },
  });

  if (!user || user.status !== 'active') {
    redirect(buildAccessPageUrl({
      reason: 'login-required',
      area: 'user',
      next: '/user/home',
    }));
  }

  return {
    raw: user,
    shell: {
      id: user.id,
      username: user.username,
      email: user.email,
      balance: toNumber(user.balance, 0),
      game_balance: toNumber(user.game_balance, 0),
      rank: user.rank || 'Member',
      role: String(user.role || 'member'),
      avatar: buildLegacyAssetUrl(user.avatar) || undefined,
      is_blue_tick: Boolean(user.is_blue_tick),
    },
  };
}
