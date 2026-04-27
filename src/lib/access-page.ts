export type AccessPageReason = 'already-authenticated' | 'login-required' | 'admin-only' | 'service-alias';
export type AccessPageArea = 'auth' | 'user' | 'admin';

export function buildAccessPageUrl(input: {
  reason: AccessPageReason;
  area?: AccessPageArea;
  role?: string | null;
  next?: string | null;
  service?: string | null;
}) {
  const query = new URLSearchParams();
  query.set('reason', input.reason);

  if (input.area) {
    query.set('area', input.area);
  }

  const role = String(input.role || '').trim();
  if (role) {
    query.set('role', role);
  }

  const next = String(input.next || '').trim();
  if (next) {
    query.set('next', next);
  }

  const service = String(input.service || '').trim();
  if (service) {
    query.set('service', service);
  }

  const search = query.toString();
  return `/access${search ? `?${search}` : ''}`;
}
