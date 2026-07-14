import 'server-only';

import { db } from '@/lib/db';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { toNumber } from '@/lib/utils';
import { ensureProxyTables } from '@/lib/proxy-service';
import { ensureVpsGpuInstancesTable } from '@/lib/vps-gpu-billing';

type Row = Record<string, unknown>;

export interface MonitorOrder {
  id: string;
  numericId: number;
  type: 'proxy' | 'vps-gpu' | 'cloud-vps';
  code: string;
  username: string;
  userId: number | null;
  title: string;
  quantity: number;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  detail: string;
  note: string;
  href?: string;
}

export interface MonitorStats {
  total: number;
  active: number;
  pending: number;
  completed: number;
  revenue: number;
}

export interface MonitorSection {
  key: 'proxy' | 'vps-gpu' | 'cloud-vps';
  title: string;
  description: string;
  warning?: string | null;
  stats: MonitorStats;
  orders: MonitorOrder[];
}

export interface VpsProxyMonitorData {
  updatedAt: string;
  sections: MonitorSection[];
  stats: MonitorStats & {
    proxy: number;
    vpsGpu: number;
    cloudVps: number;
  };
}

function normalizeRow<T extends Row>(row: T): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value instanceof Date) return [key, serializeDatabaseDateTime(value)];
    if (typeof value === 'bigint') return [key, Number(value)];
    if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
      return [key, value.toNumber()];
    }
    return [key, value];
  })) as T;
}

function buildStats(orders: MonitorOrder[]): MonitorStats {
  const completedStatuses = new Set(['completed', 'complete', 'success', 'done', 'hoàn thành']);
  const activeStatuses = new Set(['active', 'running', 'on', 'creating', 'processing', 'progressing', 'deletion_pending']);
  const pendingStatuses = new Set(['pending', 'processing', 'creating', 'progressing', 'deletion_pending', 'đang xử lý']);

  return {
    total: orders.length,
    active: orders.filter((order) => activeStatuses.has(order.status.toLowerCase())).length,
    pending: orders.filter((order) => pendingStatuses.has(order.status.toLowerCase())).length,
    completed: orders.filter((order) => completedStatuses.has(order.status.toLowerCase())).length,
    revenue: orders.reduce((sum, order) => sum + Math.max(0, toNumber(order.amount, 0)), 0),
  };
}

function mergeStats(sections: MonitorSection[]): VpsProxyMonitorData['stats'] {
  const orders = sections.flatMap((section) => section.orders);
  return {
    ...buildStats(orders),
    proxy: sections.find((section) => section.key === 'proxy')?.orders.length || 0,
    vpsGpu: sections.find((section) => section.key === 'vps-gpu')?.orders.length || 0,
    cloudVps: sections.find((section) => section.key === 'cloud-vps')?.orders.length || 0,
  };
}

async function getProxySection(): Promise<MonitorSection> {
  try {
    await ensureProxyTables();
    const rows = await db.$queryRawUnsafe<Row[]>(`
      SELECT
        po.id,
        po.user_id,
        po.kind,
        po.status,
        po.package_name,
        po.location,
        po.proxy_type,
        po.protocol,
        po.days,
        po.quantity,
        po.total_price,
        po.note,
        po.created_at,
        po.updated_at,
        COALESCE(NULLIF(u.username, ''), NULLIF(u.fullname, ''), CONCAT('User #', po.user_id)) AS username
      FROM proxy_orders po
      LEFT JOIN users u ON u.id = po.user_id
      ORDER BY po.created_at DESC, po.id DESC
      LIMIT 80
    `);

    const orders = rows.map(normalizeRow).map((row) => {
      const id = Number(row.id || 0);
      const kind = String(row.kind || 'buy');
      const location = String(row.location || '').trim();
      const proxyType = String(row.proxy_type || '').trim();
      const protocol = String(row.protocol || '').trim();
      const days = Math.max(0, Math.trunc(toNumber(row.days, 0)));
      const quantity = Math.max(0, Math.trunc(toNumber(row.quantity, 0)));

      return {
        id: `proxy-${id}`,
        numericId: id,
        type: 'proxy' as const,
        code: `PX-${id}`,
        username: String(row.username || `User #${row.user_id || 0}`),
        userId: Number(row.user_id || 0) || null,
        title: String(row.package_name || (kind === 'renew' ? 'Gia hạn proxy' : 'Mua proxy')),
        quantity,
        amount: toNumber(row.total_price, 0),
        status: String(row.status || 'pending'),
        createdAt: String(row.created_at || ''),
        updatedAt: String(row.updated_at || ''),
        detail: [kind === 'renew' ? 'Gia hạn' : 'Mua mới', location, proxyType, protocol, days ? `${days} ngày` : '', quantity ? `${quantity} proxy` : '']
          .filter(Boolean)
          .join(' · '),
        note: String(row.note || ''),
        href: '/admin/proxy',
      };
    });

    return {
      key: 'proxy',
      title: 'Đơn Proxy',
      description: 'Theo dõi đơn mua/gia hạn proxy đã ghi nhận trong hệ thống.',
      stats: buildStats(orders),
      orders,
    };
  } catch (error) {
    return {
      key: 'proxy',
      title: 'Đơn Proxy',
      description: 'Theo dõi đơn mua/gia hạn proxy đã ghi nhận trong hệ thống.',
      warning: error instanceof Error ? error.message : 'Không tải được đơn proxy',
      stats: buildStats([]),
      orders: [],
    };
  }
}

async function getVpsGpuSection(): Promise<MonitorSection> {
  try {
    await ensureVpsGpuInstancesTable();
    const rows = await db.$queryRawUnsafe<Row[]>(`
      SELECT
        vi.id,
        vi.user_id,
        vi.provider_instance_id,
        vi.offer_id,
        vi.instance_name,
        vi.status,
        vi.provider_status,
        vi.sale_hourly_vnd,
        vi.total_charged_vnd,
        vi.internet_charged_vnd,
        vi.started_at,
        vi.next_charge_at,
        vi.ended_at,
        vi.end_reason,
        vi.created_at,
        vi.updated_at,
        COALESCE(NULLIF(u.username, ''), NULLIF(u.fullname, ''), CONCAT('User #', vi.user_id)) AS username
      FROM vps_gpu_instances vi
      LEFT JOIN users u ON u.id = vi.user_id
      ORDER BY vi.created_at DESC, vi.id DESC
      LIMIT 80
    `);

    const orders = rows.map(normalizeRow).map((row) => {
      const id = Number(row.id || 0);
      const providerInstanceId = String(row.provider_instance_id || '').trim();
      const saleHourly = toNumber(row.sale_hourly_vnd, 0);
      const totalCharged = toNumber(row.total_charged_vnd, 0) + toNumber(row.internet_charged_vnd, 0);

      return {
        id: `vps-gpu-${id}`,
        numericId: id,
        type: 'vps-gpu' as const,
        code: providerInstanceId ? `GPU-${providerInstanceId}` : `GPU-${id}`,
        username: String(row.username || `User #${row.user_id || 0}`),
        userId: Number(row.user_id || 0) || null,
        title: String(row.instance_name || 'VPS GPU AI'),
        quantity: 1,
        amount: totalCharged,
        status: String(row.status || row.provider_status || 'active'),
        createdAt: String(row.started_at || row.created_at || ''),
        updatedAt: String(row.updated_at || row.next_charge_at || ''),
        detail: [
          providerInstanceId ? `Instance ${providerInstanceId}` : '',
          row.offer_id ? `Offer ${row.offer_id}` : '',
          saleHourly ? `${saleHourly.toLocaleString('vi-VN')} đ/giờ` : '',
          row.next_charge_at ? `Charge tiếp ${serializeDatabaseDateTime(row.next_charge_at)}` : '',
        ].filter(Boolean).join(' · '),
        note: String(row.end_reason || ''),
        href: '/admin/vps-gpu-costs',
      };
    });

    return {
      key: 'vps-gpu',
      title: 'VPS GPU',
      description: 'Giám sát instance VPS GPU local đang tính tiền theo giờ.',
      stats: buildStats(orders),
      orders,
    };
  } catch (error) {
    return {
      key: 'vps-gpu',
      title: 'VPS GPU',
      description: 'Giám sát instance VPS GPU local đang tính tiền theo giờ.',
      warning: error instanceof Error ? error.message : 'Không tải được VPS GPU',
      stats: buildStats([]),
      orders: [],
    };
  }
}

function getVpsPortalBaseUrl() {
  return String(
    process.env.VPS_PORTAL_API_BASE_URL ||
      process.env.NEXT_PUBLIC_VPS_PORTAL_API_BASE_URL ||
      process.env.INTEGRATED_VPS_API_BASE_URL ||
      ''
  ).trim().replace(/\/+$/, '');
}

async function fetchPortalJson(path: string, token: string) {
  const base = getVpsPortalBaseUrl();
  if (!base) throw new Error('Thiếu VPS_PORTAL_API_BASE_URL');

  const normalizedBase = base.replace(/\/api\/?$/i, '');
  const response = await fetch(`${normalizedBase}/api${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((payload as { message?: unknown }).message || `Portal VPS trả HTTP ${response.status}`));
  }
  return payload as Record<string, unknown>;
}

function getVnCloudAgencyConfig() {
  const username = String(
    process.env.VNCLOUD_AGENCY_API_USERNAME ||
      process.env.VNCLOUD_API_USERNAME ||
      process.env.api_username ||
      ''
  ).trim();
  const app = String(
    process.env.VNCLOUD_AGENCY_API_APP ||
      process.env.VNCLOUD_API_APP ||
      process.env.VNCLOUD_API_PASSWORD ||
      process.env.api_password ||
      ''
  ).trim();
  const secret = String(
    process.env.VNCLOUD_AGENCY_API_SECRET ||
      process.env.VNCLOUD_API_SECRET ||
      process.env.VNCLOUD_API_TOKEN ||
      process.env.api_token ||
      ''
  ).trim();
  const baseUrl = String(process.env.VNCLOUD_AGENCY_API_BASE_URL || 'https://portal.vncloud.net')
    .trim()
    .replace(/\/+$/, '');

  return { username, app, secret, baseUrl };
}

function hasVnCloudAgencyConfig() {
  const config = getVnCloudAgencyConfig();
  return Boolean(config.username && config.app && config.secret);
}

async function fetchVnCloudAgencyJson(path: string, init: RequestInit = {}) {
  const config = getVnCloudAgencyConfig();
  if (!config.username || !config.app || !config.secret) {
    throw new Error('Thiếu VNCLOUD_AGENCY_API_USERNAME, VNCLOUD_AGENCY_API_APP hoặc VNCLOUD_AGENCY_API_SECRET');
  }

  const tokenResponse = await fetch(`${config.baseUrl}/api/agency/get-token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'api-username': config.username,
      'api-app': config.app,
      'api-secret': config.secret,
    }),
    cache: 'no-store',
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
  const authToken = String(tokenPayload['auth-token'] || '').trim();
  if (!tokenResponse.ok || Number(tokenPayload.error || 0) !== 0 || !authToken) {
    throw new Error(String(tokenPayload.message || `VNCLOUD get-token trả HTTP ${tokenResponse.status}`));
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-username': config.username,
      'api-app': config.app,
      'api-secret': config.secret,
      'auth-token': authToken,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || Number(payload.error || 0) !== 0) {
    throw new Error(String(payload.message || `VNCLOUD trả HTTP ${response.status}`));
  }
  return payload;
}

function normalizeVnCloudMoney(value: unknown) {
  if (typeof value === 'number') return Math.max(0, value);
  const normalized = String(value || '').replace(/[^\d]/g, '');
  return Math.max(0, Number(normalized || 0));
}

function normalizeVnCloudList(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item): item is Row => Boolean(item && typeof item === 'object')) as Row[];
  if (value && typeof value === 'object') {
    return Object.values(value).filter((item): item is Row => Boolean(item && typeof item === 'object')) as Row[];
  }
  return [];
}

async function getCloudVpsFromVnCloudAgencySection(): Promise<MonitorSection> {
  try {
    const payload = await fetchVnCloudAgencyJson('/api/agency/vps/get-list-vps?type=all&qtt=300&page=0');
    const rows = normalizeVnCloudList(payload['list-service'] || payload.list_service || payload.data);
    const orders = rows.slice(0, 80).map((row) => {
      const id = Math.trunc(toNumber(row['vps-id'] || row.vps_id || row.id, 0));
      const status = String(row['vps-status'] || row.status || '').trim() || 'unknown';
      const ip = String(row.ip || '').trim();
      const os = String(row.os_name || row.os || '').trim();
      const configText = String(row['text-config'] || '').trim();
      const dayLeft = String(row['day-left'] || '').trim();
      const nextDueDate = String(row.next_due_date || row.next_due_date_vps || '').trim();

      return {
        id: `cloud-vps-vncloud-${id}`,
        numericId: id,
        type: 'cloud-vps' as const,
        code: id > 0 ? `VNCLOUD-${id}` : 'VNCLOUD',
        username: String(row.username || 'VNCLOUD'),
        userId: null,
        title: [String(row['type-vps'] || 'Cloud VPS'), configText].filter(Boolean).join(' · '),
        quantity: 1,
        amount: normalizeVnCloudMoney(row.amount),
        status,
        createdAt: String(row.date_create_vps || row.date_create || ''),
        updatedAt: nextDueDate || String(row.date_create_vps || row.date_create || ''),
        detail: [ip, os, dayLeft].filter(Boolean).join(' · '),
        note: nextDueDate ? `Hết hạn: ${nextDueDate}` : String(row.description || ''),
        href: '/admin/vps-proxy-monitor',
      };
    });

    return {
      key: 'cloud-vps',
      title: 'Cloud VPS',
      description: 'VPS thường đọc trực tiếp từ VNCLOUD Agency API.',
      warning: null,
      stats: buildStats(orders),
      orders,
    };
  } catch (error) {
    return {
      key: 'cloud-vps',
      title: 'Cloud VPS',
      description: 'VPS thường đọc trực tiếp từ VNCLOUD Agency API.',
      warning: error instanceof Error ? error.message : 'Không tải được VNCLOUD Agency API',
      stats: buildStats([]),
      orders: [],
    };
  }
}

async function getCloudVpsSection(): Promise<MonitorSection> {
  const token = String(process.env.VPS_PORTAL_ADMIN_TOKEN || process.env.INTEGRATED_VPS_ADMIN_TOKEN || '').trim();

  if (!token) {
    if (hasVnCloudAgencyConfig()) {
      return getCloudVpsFromVnCloudAgencySection();
    }

    return {
      key: 'cloud-vps',
      title: 'Cloud VPS Portal',
      description: 'Đơn VPS thường từ portal tích hợp. Cần VPS_PORTAL_ADMIN_TOKEN để đọc API portal hoặc VNCLOUD_AGENCY_API_* để đọc trực tiếp VNCLOUD.',
      warning: 'Chưa cấu hình VPS_PORTAL_ADMIN_TOKEN hoặc VNCLOUD_AGENCY_API_* nên chỉ hiển thị Proxy và VPS GPU local.',
      stats: buildStats([]),
      orders: [],
    };
  }

  try {
    const [ordersPayload, instancesPayload] = await Promise.all([
      fetchPortalJson('/admin/orders', token),
      fetchPortalJson('/admin/instances', token).catch((error) => ({ instances: [], warning: error instanceof Error ? error.message : 'Không tải được instances' })),
    ]);
    const instances = Array.isArray(instancesPayload.instances) ? instancesPayload.instances as Row[] : [];
    const instanceByOrder = instances.reduce<Record<string, Row[]>>((acc, item) => {
      const code = String(item.order_code || '').trim();
      if (!code) return acc;
      acc[code] = [...(acc[code] || []), item];
      return acc;
    }, {});
    const rows = Array.isArray(ordersPayload.orders) ? ordersPayload.orders as Row[] : [];
    const orders = rows.slice(0, 80).map(normalizeRow).map((row) => {
      const id = Number(row.id || 0);
      const orderCode = String(row.order_code || `VPS-${id}`);
      const relatedInstances = instanceByOrder[orderCode] || [];
      const instanceText = relatedInstances
        .slice(0, 3)
        .map((instance) => `#${String(instance.vncloud_vps_id || instance.id || '').trim()} ${String(instance.status || '').trim()}`.trim())
        .filter(Boolean)
        .join(', ');

      return {
        id: `cloud-vps-${id}`,
        numericId: id,
        type: 'cloud-vps' as const,
        code: orderCode,
        username: String(row.username || row.email || 'Khách VPS'),
        userId: null,
        title: String(row.title || 'Cloud VPS'),
        quantity: Math.max(1, Math.trunc(toNumber(row.quantity, 1))),
        amount: toNumber(row.total_price, 0),
        status: String(row.status || 'pending'),
        createdAt: String(row.created_at || ''),
        updatedAt: String(row.updated_at || row.created_at || ''),
        detail: instanceText || String(row.email || ''),
        note: String(row.failure_reason || ''),
        href: '/vps/admin',
      };
    });

    return {
      key: 'cloud-vps',
      title: 'Cloud VPS Portal',
      description: 'Đơn VPS thường lấy từ API portal tích hợp.',
      warning: typeof instancesPayload.warning === 'string' ? instancesPayload.warning : null,
      stats: buildStats(orders),
      orders,
    };
  } catch (error) {
    return {
      key: 'cloud-vps',
      title: 'Cloud VPS Portal',
      description: 'Đơn VPS thường lấy từ API portal tích hợp.',
      warning: error instanceof Error ? error.message : 'Không tải được Cloud VPS portal',
      stats: buildStats([]),
      orders: [],
    };
  }
}

export async function getVpsProxyMonitorData(): Promise<VpsProxyMonitorData> {
  const [proxy, vpsGpu, cloudVps] = await Promise.all([
    getProxySection(),
    getVpsGpuSection(),
    getCloudVpsSection(),
  ]);
  const sections = [proxy, vpsGpu, cloudVps];

  return {
    updatedAt: serializeDatabaseDateTime(new Date()),
    sections,
    stats: mergeStats(sections),
  };
}
