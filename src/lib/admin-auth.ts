import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import { buildAccessPageUrl } from '@/lib/access-page';
import {
  canOperatorAccessAdminPath,
  canOperatorAccessResource,
  isAdminRole,
  isOperatorAdminRole,
  isOwnerOnlyAdminApiPath,
  isOwnerRole,
  OPERATOR_ADMIN_LANDING,
  type AdminResourceAction,
} from '@/lib/admin-permissions';
import { ensureBlueTickTables, isBlueTickEntitlementActive } from '@/lib/blue-tick';
import { db } from '@/lib/db';
import { getVerifiedPendingTwoFactorUserId, getVerifiedSessionUserId } from '@/lib/session-cookie';
import { logOwnerSecurityEvent, verifyOwnerActionSecurity } from '@/lib/owner-security';

export interface AdminSessionUser {
  id: number;
  username: string;
  email: string;
  role: string;
  avatar?: string | null;
  isBlueTick?: boolean;
}

export interface SessionCookieState {
  userId: number;
  hasUserSession: boolean;
  hasPending2fa: boolean;
}

export async function getSessionCookieState(): Promise<SessionCookieState> {
  const userId = await getVerifiedSessionUserId();
  const pending2faUserId = await getVerifiedPendingTwoFactorUserId();

  return {
    userId,
    hasUserSession: userId > 0,
    hasPending2fa: pending2faUserId > 0,
  };
}

export async function getSessionUser(): Promise<AdminSessionUser | null> {
  const session = await getSessionCookieState();
  const userId = session.userId;

  if (!userId) {
    return null;
  }

  await ensureBlueTickTables();

  const user = await db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      avatar: true,
      is_blue_tick: true,
      blue_tick_expiry: true,
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
    avatar: user.avatar,
    isBlueTick: isBlueTickEntitlementActive(user.is_blue_tick, user.blue_tick_expiry),
  };
}

export async function requireAdminPage() {
  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') || '/admin/dashboard';
  const user = await getSessionUser();

  if (!user) {
    redirect(buildAccessPageUrl({
      reason: 'login-required',
      area: 'admin',
      next: '/admin/dashboard',
    }));
  }

  if (!isAdminRole(user.role)) {
    redirect(buildAccessPageUrl({
      reason: 'admin-only',
      area: 'admin',
      role: user.role,
      next: '/admin/dashboard',
    }));
  }

  if (isOperatorAdminRole(user.role) && !canOperatorAccessAdminPath(pathname)) {
    redirect(OPERATOR_ADMIN_LANDING);
  }

  return user;
}

export async function requireOwnerPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(buildAccessPageUrl({
      reason: 'login-required',
      area: 'admin',
      next: '/admin/dashboard',
    }));
  }

  if (!isOwnerRole(user.role)) {
    redirect(buildAccessPageUrl({
      reason: 'admin-only',
      area: 'admin',
      role: user.role,
      next: '/admin/dashboard',
    }));
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

  if (!isAdminRole(user.role)) {
    return {
      user,
      response: NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 }),
    };
  }

  if (req && isOperatorAdminRole(user.role) && isOwnerOnlyAdminApiPath(req.nextUrl.pathname)) {
    await logOwnerSecurityEvent({
      user,
      req,
      eventType: 'ADMIN_OWNER_ONLY_API_DENIED',
      layer: 'rbac',
      verdict: 'blocked',
      riskScore: 80,
      reasons: [req.nextUrl.pathname],
    });
    return {
      user,
      response: NextResponse.json(
        { success: false, message: 'Admin thường chỉ được quản lý đơn. Khu vực này dành cho owner.' },
        { status: 403 }
      ),
    };
  }

  if (req && isOwnerRole(user.role) && isOwnerOnlyAdminApiPath(req.nextUrl.pathname)) {
    const ownerResponse = await verifyOwnerActionSecurity(req, user, req.nextUrl.pathname);
    if (ownerResponse) {
      return {
        user,
        response: ownerResponse,
      };
    }
  }

  if (req) {
    await db.users.update({
      where: { id: user.id },
      data: { last_activity: new Date() },
    }).catch(() => undefined);
  }

  return { user, response: null };
}

export async function requireOwnerApi(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) {
    return auth;
  }

  const ownerResponse = await verifyOwnerActionSecurity(req, auth.user!, req.nextUrl.pathname);
  if (ownerResponse) {
    return { user: auth.user, response: ownerResponse };
  }

  return auth;
}

export async function assertAdminResourceAccess(
  user: AdminSessionUser,
  resource: string,
  action: AdminResourceAction,
  req: NextRequest
) {
  if (isOwnerRole(user.role)) {
    const ownerResponse = await verifyOwnerActionSecurity(req, user, `${action}:${resource}`);
    if (ownerResponse) {
      return ownerResponse;
    }
    return null;
  }

  if (isOperatorAdminRole(user.role) && canOperatorAccessResource(resource, action)) {
    return null;
  }

  await logOwnerSecurityEvent({
    user,
    req,
    eventType: 'ADMIN_RESOURCE_DENIED',
    layer: 'rbac',
    verdict: 'blocked',
    riskScore: 80,
    reasons: [`${action}:${resource}`],
  });

  return NextResponse.json(
    { success: false, message: 'Admin thường chỉ được quản lý đơn. Resource này dành cho owner.' },
    { status: 403 }
  );
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
