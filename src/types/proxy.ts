export interface ProxyPricingRule {
  enabled?: boolean;
  sellPricePerDay?: number;
  renewPricePerDay?: number;
  label?: string;
  note?: string;
}

export interface ProxyPackageRecord {
  id: string;
  location: string;
  name: string;
  type: string;
  durationDays: number;
  minDays: number;
  maxQuantity: number;
  providerPrice: number;
  providerDailyPrice: number;
  suggestedPricePerDay: number;
  sellPricePerDay: number;
  renewPricePerDay: number;
  enabled: boolean;
  label: string;
  note: string;
}

export interface ProxyOwnedItem {
  id: number;
  orderId: number | null;
  providerProxyId: string;
  packageId: string;
  packageName: string;
  location: string;
  proxyType: string;
  protocol: string;
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  status: string;
  expiredAt: string;
  providerCreatedAt: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyOrderSummary {
  id: number;
  kind: 'buy' | 'renew';
  status: string;
  packageId: string;
  packageName: string;
  location: string;
  proxyType: string;
  protocol: string;
  days: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  targetProxyIds: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyProviderProfile {
  name: string;
  email: string;
  role: string;
  cash: number;
  discount: number;
}

export interface ProxyServiceSettings {
  serviceStatus: string;
  serviceName: string;
  serviceDescription: string;
  serviceNote: string;
  defaultProtocol: 'HTTP' | 'SOCKS5';
  priceMultiplier: number;
  envConfigured: boolean;
  baseUrl: string;
  maskedToken: string;
  packagePricing: Record<string, ProxyPricingRule>;
}

export interface ProxyMarketplaceStats {
  totalPackages: number;
  enabledPackages: number;
  totalOwned: number;
  activeOwned: number;
  expiringSoon: number;
  totalOrders: number;
}

export interface ProxyMarketplaceOverview {
  settings: Omit<ProxyServiceSettings, 'packagePricing' | 'maskedToken'>;
  packages: ProxyPackageRecord[];
  proxies: ProxyOwnedItem[];
  orders: ProxyOrderSummary[];
  stats: ProxyMarketplaceStats;
}

export interface ProxyAdminDashboardData {
  settings: ProxyServiceSettings;
  profile: ProxyProviderProfile | null;
  packages: ProxyPackageRecord[];
  orders: ProxyOrderSummary[];
  stats: ProxyMarketplaceStats & {
    providerCash: number;
    providerDiscount: number;
  };
}
