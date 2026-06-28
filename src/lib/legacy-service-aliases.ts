export interface LegacyServiceAliasEntry {
  slug: string;
  label: string;
  target: string;
  area: 'auth' | 'user';
  preserveTail?: boolean;
}

export interface LegacyServiceResolution {
  slug: string;
  label: string;
  area: 'auth' | 'user';
  target: string;
}

const LEGACY_SERVICE_ALIASES: LegacyServiceAliasEntry[] = [
  { slug: 'auth', label: 'Cổng xác thực', target: '/auth/login', area: 'auth' },
  { slug: 'login', label: 'Đăng nhập', target: '/auth/login', area: 'auth' },
  { slug: 'register', label: 'Đăng ký', target: '/auth/register', area: 'auth' },
  { slug: 'admin-login', label: 'Cổng admin', target: '/auth/admin-login', area: 'auth' },
  { slug: 'forgot-password', label: 'Quên mật khẩu', target: '/auth/forgot-password', area: 'auth' },
  { slug: 'reset-password', label: 'Đặt lại mật khẩu', target: '/auth/reset-password', area: 'auth' },
  { slug: 'setup-email', label: 'Thiết lập email', target: '/auth/setup-email', area: 'auth' },
  { slug: '2fa', label: 'Xác thực 2 lớp', target: '/auth/2fa', area: 'auth' },
  { slug: 'user', label: 'Khu người dùng', target: '/user/home', area: 'user' },
  { slug: 'home', label: 'Trang người dùng', target: '/user/home', area: 'user' },
  { slug: 'orders', label: 'Đơn hàng', target: '/user/orders', area: 'user' },
  { slug: 'history', label: 'Lịch sử', target: '/user/history', area: 'user' },
  { slug: 'profile', label: 'Hồ sơ', target: '/user/profile', area: 'user' },
  { slug: 'cart', label: 'Giỏ hàng', target: '/user/cart', area: 'user' },
  { slug: 'chatbot', label: 'AI người dùng', target: '/user/chatbot', area: 'user' },
  { slug: 'statistics', label: 'Thống kê', target: '/user/statistics', area: 'user' },
  { slug: 'automxh', label: 'Auto MXH', target: '/user/automxh', area: 'user', preserveTail: true },
  { slug: 'smm', label: 'SMM dịch vụ', target: '/user/smm', area: 'user', preserveTail: true },
  { slug: 'resources', label: 'Tài nguyên MMO', target: '/user/resources', area: 'user', preserveTail: true },
  { slug: 'game-accounts', label: 'Thuê tài khoản game 99 năm', target: '/user/game-accounts', area: 'user', preserveTail: true },
  { slug: 'tai-khoan-game', label: 'Thuê tài khoản game 99 năm', target: '/user/game-accounts', area: 'user', preserveTail: true },
  { slug: 'random-game-accounts', label: 'Random thuê tài khoản game 99 năm', target: '/user/random-game-accounts', area: 'user', preserveTail: true },
  { slug: 'random-game', label: 'Random thuê tài khoản game 99 năm', target: '/user/random-game-accounts', area: 'user', preserveTail: true },
  { slug: 'support-tiktok', label: 'Support TikTok', target: '/user/support-tiktok', area: 'user', preserveTail: true },
  { slug: 'meta-support', label: 'Auto kích nút Meta', target: '/user/meta-support', area: 'user', preserveTail: true },
  { slug: 'web-service', label: 'Web con MMO và Build Website', target: '/user/web-service', area: 'user', preserveTail: true },
  { slug: 'build-website', label: 'Build Website', target: '/user/web-service', area: 'user', preserveTail: true },
  { slug: 'forum', label: 'Forum MMO', target: '/user/forum', area: 'user', preserveTail: true },
  { slug: 'find-job', label: 'Find Job', target: '/user/find-job', area: 'user', preserveTail: true },
  { slug: 'game-market', label: 'Game Market', target: '/user/game-market', area: 'user', preserveTail: true },
  { slug: 'card', label: 'Thẻ cào', target: '/user/card', area: 'user' },
  { slug: 'seller', label: 'Kênh người bán', target: '/user/seller', area: 'user', preserveTail: true },
  { slug: 'social', label: 'Mạng xã hội nội bộ', target: '/user/social', area: 'user', preserveTail: true },
];

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}

export function resolveLegacyServicePath(segments: string[]): LegacyServiceResolution | null {
  const normalizedSegments = segments
    .map((segment) => trimSlashes(String(segment || '').trim().toLowerCase()))
    .filter(Boolean);

  if (normalizedSegments.length === 0) {
    return null;
  }

  const [head, ...tail] = normalizedSegments;
  const alias = LEGACY_SERVICE_ALIASES.find((item) => item.slug === head);

  if (!alias) {
    return null;
  }

  if (tail.length > 0 && !alias.preserveTail) {
    return null;
  }

  const tailPath = alias.preserveTail && tail.length > 0 ? `/${tail.join('/')}` : '';

  return {
    slug: alias.slug,
    label: alias.label,
    area: alias.area,
    target: `${alias.target}${tailPath}`,
  };
}
