// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s+/g, '');
    if (!normalized) {
      return fallback;
    }

    const parsed = Number(normalized.replace(/,/g, '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function formatVND(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount.replace(/\./g, '').replace(',', '.')) : amount;
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: vi });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function getStatusColor(status: string): string {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    success: { bg: '#DCFCE7', text: '#166534', label: 'Hoàn tất' },
    pending: { bg: '#FEF9C3', text: '#854D0E', label: 'Đang chờ' },
    processing: { bg: '#DBEAFE', text: '#1E40AF', label: 'Đang xử lý' },
    'in progress': { bg: '#DBEAFE', text: '#1E40AF', label: 'Đang chạy' },
    paused: { bg: '#FFEDD5', text: '#9A3412', label: 'Tạm dừng' },
    error: { bg: '#FEE2E2', text: '#991B1B', label: 'Lỗi/Thất bại' },
    failed: { bg: '#FEE2E2', text: '#991B1B', label: 'Thất bại' },
    refund: { bg: '#F3E8FF', text: '#6B21A8', label: 'Hoàn tiền' },
    refunded: { bg: '#F3E8FF', text: '#6B21A8', label: 'Hoàn tiền' },
    completed: { bg: '#DCFCE7', text: '#166534', label: 'Hoàn tất' },
    canceled: { bg: '#FEE2E2', text: '#991B1B', label: 'Đã hủy' },
    cancelled: { bg: '#FEE2E2', text: '#991B1B', label: 'Đã hủy' },
    active: { bg: '#DCFCE7', text: '#166534', label: 'Hoạt động' },
    inactive: { bg: '#FEE2E2', text: '#991B1B', label: 'Không hoạt động' },
  };
  return map[status.toLowerCase()]?.label ?? status;
}

export function getRankConfig(rank: string) {
  const map: Record<string, { color: string; bg: string; icon: string }> = {
    'Thành viên': { color: 'text-slate-500', bg: 'bg-slate-500/10', icon: 'user' },
    'Đồng': { color: 'text-orange-500', bg: 'bg-orange-500/10', icon: 'medal' },
    'Bạc': { color: 'text-slate-400', bg: 'bg-slate-400/10', icon: 'award' },
    'Vàng': { color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: 'trophy' },
    'Kim Cương': { color: 'text-brand-blue', bg: 'bg-brand-blue/10', icon: 'gem' },
  };
  return map[rank] ?? map['Thành viên'];
}
