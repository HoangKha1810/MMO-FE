// src/types/index.ts

export interface User {
  id: number;
  username: string;
  email: string;
  fullname?: string;
  phone?: string;
  avatar?: string;
  balance: number;
  game_balance: number;
  rank: string;
  role: string;
  status: string;
  is_blue_tick: boolean;
  twofa_enabled: boolean;
  telegram_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  setting_key: string;
  setting_value: string;
}

export interface ServiceCard {
  title: string;
  icon: string;
  desc: string;
  link: string;
  maintenance: boolean;
  color: string;
  textColor: string;
  index: number;
}

export interface DashboardStats {
  balance: number;
  game_balance: number;
  rank: string;
  totalDeposit: number;
  monthlyDeposit: number;
}

export interface AdminPulse {
  total_users: number;
  locked_users: number;
  twofa_users: number;
  total_liability: number;
  realtime_orders: number;
  smm_delayed: number;
  blacklisted_ips: number;
  pending_reports: number;
  smm_platform_stats: SmmPlatformStat[];
  smm_top_services: SmmTopService[];
}

export interface SmmPlatformStat {
  platform: string;
  count: number;
  revenue: number;
}

export interface SmmTopService {
  service_name: string;
  count: number;
  revenue: number;
}

export interface PerformanceStats {
  smm_revenue: number;
  smm_cost: number;
  smm_profit: number;
  smm_total: number;
  smm_success: number;
  smm_pending: number;
  smm_processing: number;
  smm_refunded: number;
  amx_revenue: number;
  amx_cost: number;
  amx_profit: number;
  amx_success: number;
  amx_failed: number;
  amx_pending: number;
  amx_total: number;
  forum_posts: number;
  forum_threads: number;
  game_revenue: number;
  game_orders: number;
  new_users: number;
  deposit: number;
  spent: number;
  refunds_money: number;
  active_users: number;
  success_rate: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string>;
}

export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  per_page: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
}
