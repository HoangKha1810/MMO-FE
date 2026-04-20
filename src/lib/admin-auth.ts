import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface AdminSessionUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

export async function getSessionUser(): Promise<AdminSessionUser | null> {
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
      role: true,
      status: true,
    },
  });

  if (!user || user.status !== 'active') {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: String(user.role || 'member'),
  };
}

export async function requireAdminPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect('/auth/login');
  }

  if (user.role !== 'admin') {
    redirect('/user/home');
  }

  return user;
}

export async function requireAdminApi(req?: NextRequest) {
  const user = await getSessionUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (user.role !== 'admin') {
    return {
      user,
      response: NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 }),
    };
  }

  if (req) {
    await db.users.update({
      where: { id: user.id },
      data: { last_activity: new Date() },
    }).catch(() => undefined);
  }

  return { user, response: null };
}

export function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export async function logAdminAction(input: {
  adminId: number;
  action: string;
  target?: string;
  req?: NextRequest;
}) {
  await db.activity_logs.create({
    data: {
      user_id: input.adminId,
      activity: input.target ? `${input.action}: ${input.target}` : input.action,
      ip_address: input.req ? getClientIp(input.req) : undefined,
      user_agent: input.req?.headers.get('user-agent') || undefined,
    },
  }).catch(() => undefined);
}
