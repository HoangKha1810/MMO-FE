import { notFound, redirect } from 'next/navigation';
import { buildAccessPageUrl } from '@/lib/access-page';
import { getSessionCookieState } from '@/lib/admin-auth';
import { resolveLegacyServicePath } from '@/lib/legacy-service-aliases';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LegacyServiceAliasPage({
  params,
}: {
  params: Promise<{ legacyPath: string[] }>;
}) {
  const { legacyPath } = await params;
  const alias = resolveLegacyServicePath(Array.isArray(legacyPath) ? legacyPath : []);

  if (!alias) {
    notFound();
  }

  const session = await getSessionCookieState();

  if (alias.area === 'auth' && session.hasUserSession && !session.hasPending2fa) {
    redirect(buildAccessPageUrl({
      reason: 'already-authenticated',
      area: 'auth',
      next: alias.target,
      service: alias.label,
    }));
  }

  redirect(buildAccessPageUrl({
    reason: 'service-alias',
    area: alias.area,
    next: alias.target,
    service: alias.label,
  }));
}
