export type AdminResourceAction = 'list' | 'detail' | 'create' | 'update' | 'delete' | 'action';

export const OPERATOR_ADMIN_LANDING = '/admin/orders';

export const ORDER_ADMIN_RESOURCES = new Set([
  'smm-orders',
  'automxh-orders',
  'meta-support-orders',
  'tiktok-orders',
  'vibe-code-orders',
  'web-service-orders',
  'press-orders',
  'card-orders',
  'game-orders',
  'tiktok-channel-orders',
]);

export const FORUM_APPROVAL_ADMIN_RESOURCES = new Set([
  'forum-threads',
  'forum-posts',
  'forum-reports',
]);

export const TIKTOK_CHANNEL_ADMIN_RESOURCES = new Set([
  'tiktok-channel-products',
]);

export const OPERATOR_ADMIN_PATH_PREFIXES = [
  '/admin/orders',
  '/admin/smm/orders',
  '/admin/automxh/orders',
  '/admin/meta-support',
  '/admin/support-tiktok/orders',
  '/admin/vibe-code',
  '/admin/kenh-tiktok',
  '/admin/web-service',
  '/admin/press',
  '/admin/card/history',
  '/admin/game-market',
  '/admin/forum/approvals',
];

export const OWNER_ONLY_ADMIN_API_PREFIXES = [
  '/api/admin/dashboard',
  '/api/admin/ai',
  '/api/admin/pricing',
  '/api/admin/game-api',
  '/api/admin/proxy',
  '/api/admin/vps-proxy-monitor',
  '/api/admin/service-statuses',
  '/api/admin/users/password',
  '/api/admin/resources/products',
];

export function isOwnerRole(role: unknown) {
  return String(role || '').trim().toLowerCase() === 'owner';
}

export function isAdminRole(role: unknown) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'admin' || normalized === 'owner';
}

export function isOperatorAdminRole(role: unknown) {
  return String(role || '').trim().toLowerCase() === 'admin';
}

function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canOperatorAccessAdminPath(pathname: string) {
  const normalized = String(pathname || '').split('?')[0] || '/admin';
  return OPERATOR_ADMIN_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(normalized, prefix));
}

export function isOwnerOnlyAdminApiPath(pathname: string) {
  const normalized = String(pathname || '').split('?')[0];
  return OWNER_ONLY_ADMIN_API_PREFIXES.some((prefix) => pathMatchesPrefix(normalized, prefix));
}

export function canOperatorAccessResource(resource: string, action: AdminResourceAction) {
  if (ORDER_ADMIN_RESOURCES.has(resource)) {
    return action === 'list' || action === 'detail' || action === 'update' || action === 'delete' || action === 'action';
  }

  if (FORUM_APPROVAL_ADMIN_RESOURCES.has(resource)) {
    return action === 'list' || action === 'detail' || action === 'update' || action === 'action';
  }

  if (TIKTOK_CHANNEL_ADMIN_RESOURCES.has(resource)) {
    return action === 'list' || action === 'detail' || action === 'update' || action === 'action';
  }

  return false;
}
