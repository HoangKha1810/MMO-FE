export type ThemeMode = "light" | "dark";

export interface StoreSettings {
  brand_name: string;
  hero_title: string;
  hero_subtitle: string;
  hero_badge: string;
  support_link: string;
  announcement: string;
  theme_default: ThemeMode;
  intro_customer_count: string;
  addon_cpu_price: number;
  addon_ram_price: number;
  addon_disk_price: number;
  addon_disk_step: number;
}

export interface CatalogItem {
  id: number;
  sku: string;
  title: string;
  slug: string;
  vncloud_product_id?: number;
  vncloud_os_id?: number;
  short_description: string | null;
  description: string | null;
  sale_price: number;
  compare_price: number | null;
  billing_cycle_code: string;
  billing_cycle_label: string | null;
  addon_cpu: number;
  addon_ram: number;
  addon_disk: number;
  badge_text: string | null;
  hero_gradient_from: string;
  hero_gradient_to: string;
  sort_order?: number;
  is_active?: number;
  is_featured: number;
  cpu_label: string | null;
  ram_label: string | null;
  disk_label: string | null;
  bandwidth_label: string | null;
  operating_system_name: string | null;
}

export interface StorefrontData {
  settings: StoreSettings;
  stats: {
    total_orders: number;
    live_instances: number;
    total_customers: number;
  };
  operatingSystems: string[];
  items: CatalogItem[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  fullname: string | null;
  role: string;
  status: string;
  balance: number;
  rank?: string | null;
  email_verified?: number;
  two_factor_enabled?: number;
  avatar: string | null;
}

export interface Session {
  token: string;
  user: User;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface MyInstance {
  id: number;
  order_id: number;
  order_code: string | null;
  title: string | null;
  billing_cycle_code: string | null;
  order_created_at: string | null;
  unit_price: number | null;
  total_price: number | null;
  quantity: number | null;
  vncloud_vps_id: number;
  ip_address: string | null;
  username: string | null;
  password: string | null;
  status: string;
  next_due_date: string | null;
  auto_renew: number;
  operating_system_name?: string | null;
}

export interface MyOrder {
  id: number;
  order_code: string;
  title: string;
  billing_cycle_code: string;
  unit_price: number;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  buyer_note: string | null;
  failure_reason: string | null;
  refund_requested_at?: string | null;
  refund_amount?: number | null;
  instances: MyInstance[];
}

export interface OrdersResponse {
  orders: MyOrder[];
  instances: MyInstance[];
  transactions: UserTransaction[];
  summary: PortalSummary;
}

export interface UserTransaction {
  id: number;
  amount: number;
  balance_after: number | null;
  content: string | null;
  type: string;
  status: string;
  created_at: string;
}

export interface PortalSummary {
  total_orders: number;
  active_instances: number;
  expired_instances: number;
  cancelled_instances: number;
  total_spent: number;
  total_deposited: number;
  notifications: number;
}

export interface AdminSummary {
  active_catalog: number;
  total_orders: number;
  total_instances: number;
  gross_revenue: number;
  customers: number;
}

export interface AdminOrder {
  id: number;
  order_code: string;
  status: string;
  total_price: number;
  quantity: number;
  created_at: string;
  failure_reason: string | null;
  refund_requested_at?: string | null;
  refund_amount?: number | null;
  username: string;
  email: string;
  title: string;
}

export interface AdminInstance {
  id: number;
  vncloud_vps_id: number;
  status: string;
  ip_address: string | null;
  username?: string | null;
  password?: string | null;
  next_due_date: string | null;
  auto_renew?: number;
  owner_username?: string;
  owner_email?: string;
  order_code?: string;
}

export interface AdminDashboard {
  summary: AdminSummary;
  recentOrders: AdminOrder[];
  recentInstances: AdminInstance[];
  agency: Record<string, unknown>;
  settings: StoreSettings;
}

export interface RemoteProduct {
  vncloud_product_id: number;
  name: string;
  category: string | null;
  region: string | null;
  base_price: number;
  cpu_label: string | null;
  ram_label: string | null;
  disk_label: string | null;
  bandwidth_label: string | null;
}

export interface RemoteBillingCycle {
  cycle_code: string;
  label: string;
  months: number;
}

export interface RemoteOs {
  vncloud_os_id: number;
  name: string;
  group_name: string | null;
  is_active: number;
}

export interface AdminCatalogResources {
  products: RemoteProduct[];
  billingCycles: RemoteBillingCycle[];
  operatingSystems: RemoteOs[];
}
