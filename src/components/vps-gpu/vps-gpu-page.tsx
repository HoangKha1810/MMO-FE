'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clipboard,
  Cpu,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Loader2,
  MapPin,
  Monitor,
  Network,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { readJsonResponse } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/hooks/use-session-user';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';

type DeploymentMethod = 'location' | 'hostnode';
type NetworkMode = 'port-forwarding' | 'dedicated-ip';
type VastRuntime = 'ssh' | 'jupyter' | 'args';
type OfferType = 'ondemand' | 'bid';
type OfferSort = 'price-asc' | 'price-desc';

interface VpsGpuPageProps {
  initialUser?: SessionUser;
}

interface VastGpu {
  v0Name: string;
  displayName?: string;
  max_count?: number;
  availableCount?: number;
  price_per_hr?: number;
  resources?: {
    max_vcpus?: number;
    max_ram_gb?: number;
    max_storage_gb?: number;
  };
  pricing?: {
    per_vcpu_hr?: number;
    per_gb_ram_hr?: number;
    per_gb_storage_hr?: number;
    total_hourly?: number;
    cost_hourly_usd?: number;
    cost_hourly_vnd?: number;
    sale_hourly_vnd?: number;
    profit_hourly_vnd?: number;
    price_multiplier?: number;
    hourly_fee_vnd?: number;
    usd_to_vnd?: number;
  };
  network_features?: {
    dedicated_ip_available?: boolean;
    port_forwarding_available?: boolean;
    network_storage_available?: boolean;
  };
}

interface VastOfferMeta {
  id?: string | number;
  gpu_name?: string;
  num_gpus?: number;
  dph_total?: number;
  verified?: boolean | number | string;
  is_verified?: boolean | number | string;
  verified_machine?: boolean | number | string;
  machine_verified?: boolean | number | string;
  verification?: string;
  verification_status?: string;
  machine_verification?: string;
  host_verification?: string;
  vericode?: number | string;
  verification_code?: number | string;
}

interface VastLocation {
  id: string;
  city?: string;
  stateprovince?: string;
  country?: string;
  tier?: number;
  gpus?: VastGpu[];
}

interface VastHostnode {
  id: string;
  location_id?: string;
  engine?: string;
  uptime_percentage?: number;
  available_resources?: {
    gpus?: VastGpu[];
    vcpu_count?: number;
    ram_gb?: number;
    storage_gb?: number;
    has_public_ip_available?: boolean;
  };
  pricing?: {
    per_vcpu_hr?: number;
    per_gb_ram_hr?: number;
    per_gb_storage_hr?: number;
    total_hourly?: number;
    cost_hourly_usd?: number;
    cost_hourly_vnd?: number;
    sale_hourly_vnd?: number;
    profit_hourly_vnd?: number;
    price_multiplier?: number;
    hourly_fee_vnd?: number;
    usd_to_vnd?: number;
  };
  location?: {
    uuid?: string;
    city?: string;
    stateprovince?: string;
    country?: string;
    network_speed_gbps?: number;
    network_speed_upload_gbps?: number;
    tier?: number;
  };
  vast?: VastOfferMeta;
}

interface WebDesktopLink {
  internalPort?: number;
  publicPort?: number;
  host?: string;
  protocol?: 'http' | 'https';
  url: string;
  label?: string;
  source?: 'direct' | 'mapped' | 'legacy';
  primary?: boolean;
}

interface VastInstance {
  id?: string;
  name?: string;
  status?: string;
  statusLabel?: string;
  statusMessage?: string;
  sourceStatus?: {
    actualStatus?: string | null;
    curState?: string | null;
    nextState?: string | null;
    intendedStatus?: string | null;
    statusMessage?: string | null;
  };
  type?: string;
  ipAddress?: string;
  rateHourly?: number;
  attributes?: {
    name?: string;
    status?: string;
    region?: string;
  };
  connection?: {
    ready?: boolean;
    host?: string;
    port?: number;
    command?: string;
    username?: string;
    password?: string;
    rdpPort?: number;
    rdpAddress?: string;
    rdpCommand?: string;
    webDesktopInternalPort?: number;
    webDesktopPort?: number;
    webDesktopUrl?: string;
    webDesktopUrls?: WebDesktopLink[];
    publicIp?: string;
    localIps?: string[];
    portRange?: string;
    ipAddressType?: string;
  };
  specs?: {
    gpuName?: string;
    gpuCount?: number;
    gpuRamGb?: number;
    gpuUtil?: number;
    gpuTemp?: number;
    cpuName?: string;
    cpuCores?: number;
    ramGb?: number;
    diskName?: string;
    diskGb?: number;
    diskUsageGb?: number;
    machineId?: string;
    hostId?: string;
    dlperf?: number;
    networkUpMbps?: number;
    networkDownMbps?: number;
    image?: string;
  };
  billing?: {
    saleHourlyVnd?: number;
    totalChargedVnd?: number;
    nextChargeAt?: string | null;
    nextChargeAtMs?: number | null;
    lowBalanceWarningForAt?: string | null;
    lowBalanceWarningForAtMs?: number | null;
    status?: string;
  } | null;
}

interface VastOverviewData {
  locations?: unknown;
  hostnodes?: unknown;
  secrets?: unknown;
  instances?: unknown;
  defaultSshKeySecretId?: unknown;
}

interface VpsGpuPricingSettings {
  usdToVnd: number;
  priceMultiplier: number;
  hourlyFeeVnd: number;
}

const DEFAULT_VPS_GPU_PRICING: VpsGpuPricingSettings = {
  usdToVnd: 26000,
  priceMultiplier: 1.67,
  hourlyFeeVnd: 0,
};

const networkOptions: Array<{
  value: NetworkMode;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  { value: 'port-forwarding', title: 'Port public', description: 'Map remote web/app theo IP & Port Info', recommended: true },
  { value: 'dedicated-ip', title: 'Public IP riêng', description: 'Ưu tiên máy có IP tĩnh khi gói hỗ trợ' },
];

const runtimeOptions: Array<{
  value: VastRuntime;
  title: string;
  description: string;
}> = [
  { value: 'args', title: 'Entrypoint / Web GUI', description: 'Giữ entrypoint Docker để remote web tự chạy' },
  { value: 'ssh', title: 'SSH', description: 'Runtime terminal, dùng khi image không cần entrypoint gốc' },
  { value: 'jupyter', title: 'Jupyter Lab', description: 'Mở notebook trên container' },
];

const ramSteps = [8, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 512];

interface VpsGpuImagePreset {
  id: string;
  image: string;
  label: string;
  category: string;
  remote: string;
  hint: string;
  runtime: VastRuntime;
  onstart: string;
  args?: string;
  envFlags?: string;
  recommended?: boolean;
}

const vpsGpuImagePresets: VpsGpuImagePreset[] = [
  {
    id: 'gpu-desktop-selkies',
    image: 'ghcr.io/selkies-project/nvidia-egl-desktop:latest',
    label: 'Desktop GPU WebRTC EGL',
    category: 'Game / Render / Desktop',
    remote: 'WebRTC/HTML5 port 8080',
    hint: 'Desktop GPU public ổn định nhất để thao tác GUI, game nhẹ, AI web UI và render qua trình duyệt.',
    runtime: 'args',
    onstart: '',
    envFlags: [
      'TZ=Asia/Ho_Chi_Minh',
      'DISPLAY_SIZEW=1920',
      'DISPLAY_SIZEH=1080',
      'DISPLAY_REFRESH=60',
      'DISPLAY_DPI=96',
      'SIZEW=1920',
      'SIZEH=1080',
      'REFRESH=60',
      'PASSWD=trungtammmo',
      'PASSWORD=trungtammmo',
      'SELKIES_BASIC_AUTH_PASSWORD=trungtammmo',
      'SELKIES_ENCODER=nvh264enc',
      '_TTMMO_REMOTE_PROFILE=selkies',
      '_TTMMO_REMOTE_PORTS=8080',
    ].join('\n'),
    recommended: true,
  },
  {
    id: 'gpu-desktop-glx',
    image: 'ghcr.io/selkies-project/nvidia-glx-desktop:latest',
    label: 'Desktop GPU WebRTC GLX',
    category: 'Game / OpenGL / Render',
    remote: 'WebRTC/HTML5 port 8080',
    hint: 'Desktop NVIDIA có OpenGL/GLX, Vulkan và Wine/Proton, hợp test app/game/render có giao diện.',
    runtime: 'args',
    onstart: '',
    envFlags: [
      'TZ=Asia/Ho_Chi_Minh',
      'DISPLAY_SIZEW=1920',
      'DISPLAY_SIZEH=1080',
      'DISPLAY_REFRESH=60',
      'DISPLAY_DPI=96',
      'SIZEW=1920',
      'SIZEH=1080',
      'REFRESH=60',
      'PASSWD=trungtammmo',
      'PASSWORD=trungtammmo',
      'SELKIES_BASIC_AUTH_PASSWORD=trungtammmo',
      'SELKIES_ENCODER=nvh264enc',
      '_TTMMO_REMOTE_PROFILE=selkies',
      '_TTMMO_REMOTE_PORTS=8080',
    ].join('\n'),
  },
  {
    id: 'blender-web-gui',
    image: 'lscr.io/linuxserver/blender:latest',
    label: 'Blender Web GUI',
    category: 'Render Blender',
    remote: 'Blender GUI port 3000/3001',
    hint: 'Có sẵn Blender giao diện web. Dùng tốt để mở file/preview; nếu cần CUDA render nặng nên chọn Desktop GPU EGL rồi cài Blender.',
    runtime: 'args',
    onstart: '',
    envFlags: [
      'PUID=1000',
      'PGID=1000',
      'TZ=Asia/Ho_Chi_Minh',
      'AUTO_GPU=true',
      'PIXELFLUX_WAYLAND=true',
      '_TTMMO_REMOTE_PROFILE=linuxserver-web',
      '_TTMMO_REMOTE_PORTS=3001,3000',
    ].join('\n'),
  },
  {
    id: 'ubuntu-webtop',
    image: 'lscr.io/linuxserver/webtop:ubuntu-xfce',
    label: 'Ubuntu XFCE Webtop',
    category: 'Desktop GUI',
    remote: 'Webtop port 3000/3001',
    hint: 'Desktop Ubuntu dễ dùng để cài tool GUI, trình duyệt, trình quản lý file và thao tác thủ công.',
    runtime: 'args',
    onstart: '',
    envFlags: 'PUID=1000\nPGID=1000\nTZ=Asia/Ho_Chi_Minh\nCUSTOM_USER=ttmmo\nPASSWORD=trungtammmo\n_TTMMO_REMOTE_PROFILE=linuxserver-web\n_TTMMO_REMOTE_PORTS=3001,3000',
  },
  {
    id: 'xfce-novnc',
    image: 'accetto/ubuntu-vnc-xfce-g3:latest',
    label: 'Ubuntu XFCE noVNC',
    category: 'Game / Tool / Browser',
    remote: 'noVNC port 6901, VNC port 5901',
    hint: 'Desktop nhẹ, ít phụ thuộc, phù hợp thao tác web/tool và cài phần mềm nhỏ.',
    runtime: 'args',
    onstart: '',
    envFlags: 'TZ=Asia/Ho_Chi_Minh\nVNC_PW=trungtammmo\n_TTMMO_REMOTE_PROFILE=novnc\n_TTMMO_REMOTE_PORTS=6901,6080',
  },
  {
    id: 'ai-ml-desktop',
    image: 'ghcr.io/selkies-project/nvidia-egl-desktop:latest',
    label: 'AI/ML Desktop GPU',
    category: 'AI / ML',
    remote: 'WebRTC/HTML5 port 8080',
    hint: 'Desktop GPU để cài Conda, PyTorch, web UI AI hoặc notebook theo nhu cầu sau khi máy lên.',
    runtime: 'args',
    onstart: '',
    envFlags: [
      'TZ=Asia/Ho_Chi_Minh',
      'DISPLAY_SIZEW=1920',
      'DISPLAY_SIZEH=1080',
      'DISPLAY_REFRESH=60',
      'DISPLAY_DPI=96',
      'SIZEW=1920',
      'SIZEH=1080',
      'REFRESH=60',
      'PASSWD=trungtammmo',
      'PASSWORD=trungtammmo',
      'SELKIES_BASIC_AUTH_PASSWORD=trungtammmo',
      'SELKIES_ENCODER=nvh264enc',
      '_TTMMO_REMOTE_PROFILE=selkies',
      '_TTMMO_REMOTE_PORTS=8080',
    ].join('\n'),
  },
  {
    id: 'blender-xfce-fallback',
    image: 'accetto/ubuntu-vnc-xfce-blender-g3:latest',
    label: 'Blender XFCE noVNC',
    category: 'Render Blender fallback',
    remote: 'noVNC port 6901, VNC port 5901',
    hint: 'Image Blender/XFCE public nhẹ để fallback khi LinuxServer Blender không phù hợp máy đang chọn.',
    runtime: 'args',
    onstart: '',
    envFlags: 'TZ=Asia/Ho_Chi_Minh\nVNC_PW=trungtammmo\n_TTMMO_REMOTE_PROFILE=novnc\n_TTMMO_REMOTE_PORTS=6901,6080',
  },
];

const DEFAULT_VPS_GPU_IMAGE_PRESET = vpsGpuImagePresets[0];

function getVpsGpuImagePreset(presetId: string) {
  return vpsGpuImagePresets.find((preset) => preset.id === presetId) || DEFAULT_VPS_GPU_IMAGE_PRESET;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function hasOwnField(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isVerifiedHostnode(hostnode: VastHostnode) {
  const offer = asRecord(hostnode.vast);
  const verificationText = String(
    offer.verification || offer.verification_status || offer.machine_verification || offer.host_verification || ''
  )
    .trim()
    .toLowerCase();

  if (verificationText) {
    return verificationText === 'verified' || verificationText === 'secure cloud';
  }

  if (hasOwnField(offer, 'secure_cloud') && normalizeBoolean(offer.secure_cloud, false)) {
    return true;
  }

  for (const key of ['verified', 'is_verified', 'verified_machine', 'machine_verified']) {
    if (hasOwnField(offer, key)) {
      return normalizeBoolean(offer[key], false);
    }
  }

  for (const key of ['vericode', 'verification_code']) {
    if (hasOwnField(offer, key)) {
      const parsed = Number(offer[key]);
      return Number.isFinite(parsed) && parsed > 0;
    }
  }

  return true;
}

function extractLocations(payload: unknown): VastLocation[] {
  return toArray<VastLocation>(asRecord(asRecord(payload).data).locations);
}

function extractHostnodes(payload: unknown): VastHostnode[] {
  return toArray<VastHostnode>(asRecord(asRecord(payload).data).hostnodes).filter(isVerifiedHostnode);
}

function extractInstances(payload: unknown): VastInstance[] {
  const data = asRecord(asRecord(payload).data);
  const direct = toArray<VastInstance>(data.instances);
  if (direct.length) {
    return direct;
  }

  return toArray<VastInstance>(asRecord(data.attributes).instances);
}

function formatUsd(value: number | undefined) {
  if (!Number.isFinite(value || 0) || !value) {
    return '$0/h';
  }
  return `$${value.toFixed(value >= 1 ? 2 : 3)}/h`;
}

function formatVnd(value: number | undefined) {
  if (!Number.isFinite(value || 0) || !value) {
    return '0 đ/giờ';
  }

  return `${Math.round(value).toLocaleString('vi-VN')} đ/giờ`;
}

function formatMoneyVnd(value: number | undefined) {
  if (!Number.isFinite(value || 0) || !value) {
    return '0 đ';
  }

  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function formatDateTime(value?: string | number | null) {
  if (!value) {
    return 'N/A';
  }

  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${getPart('hour')}:${getPart('minute')} ${getPart('day')}-${getPart('month')}`;
}

function formatLocation(location: VastLocation | VastHostnode['location']) {
  if (!location) {
    return 'Unknown location';
  }

  return [location.city, location.stateprovince, location.country].filter(Boolean).join(', ') || 'Unknown location';
}

function getHostnodeGpu(hostnode?: VastHostnode | null) {
  return hostnode?.available_resources?.gpus?.[0] || null;
}

function getHostnodePrice(hostnode?: VastHostnode | null) {
  const offer = asRecord(hostnode?.vast);
  const price = Number(hostnode?.pricing?.total_hourly || offer.dph_total || offer.dph_base || offer.dph || 0);
  return Number.isFinite(price) ? price : 0;
}

function getHostnodeSalePrice(hostnode?: VastHostnode | null) {
  const salePrice = Number(hostnode?.pricing?.sale_hourly_vnd || 0);
  if (Number.isFinite(salePrice) && salePrice > 0) {
    return salePrice;
  }

  const costUsd = getHostnodePrice(hostnode);
  return costUsd > 0
    ? Math.ceil((costUsd * DEFAULT_VPS_GPU_PRICING.usdToVnd * DEFAULT_VPS_GPU_PRICING.priceMultiplier) / 1000) * 1000
    : 0;
}

function computeSaleHourlyFromUsd(costUsd: number, settings: VpsGpuPricingSettings) {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    return 0;
  }

  const usdToVnd = Number.isFinite(settings.usdToVnd) && settings.usdToVnd > 0 ? settings.usdToVnd : DEFAULT_VPS_GPU_PRICING.usdToVnd;
  const multiplier = Number.isFinite(settings.priceMultiplier) && settings.priceMultiplier > 0
    ? settings.priceMultiplier
    : DEFAULT_VPS_GPU_PRICING.priceMultiplier;
  const hourlyFeeVnd = Number.isFinite(settings.hourlyFeeVnd) && settings.hourlyFeeVnd > 0 ? settings.hourlyFeeVnd : 0;
  return Math.ceil((costUsd * usdToVnd * multiplier + hourlyFeeVnd) / 1000) * 1000;
}

function getHostnodeGpuLabel(hostnode?: VastHostnode | null) {
  const gpu = getHostnodeGpu(hostnode);
  return gpu?.displayName || gpu?.v0Name || normalizeOfferText(asRecord(hostnode?.vast).gpu_name, 'GPU');
}

function normalizeOfferText(value: unknown, fallback = 'N/A') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'N/A';
  const percent = parsed > 1 ? parsed : parsed * 100;
  return `${percent.toFixed(percent >= 99 ? 2 : 1)}%`;
}

function formatGb(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'N/A';
  return `${Math.round(parsed)} GB`;
}

function formatNetworkSpeed(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'N/A';
  return parsed >= 1 ? `${parsed.toFixed(1)} Gbps` : `${Math.round(parsed * 1000)} Mbps`;
}

function formatMbps(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'N/A';
  return parsed >= 1000 ? `${(parsed / 1000).toFixed(1)} Gbps` : `${Math.round(parsed)} Mbps`;
}

function formatCpuCores(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'N/A';
  return `${Number.isInteger(parsed) ? parsed : parsed.toFixed(1)} core`;
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseEnvObject(value: string) {
  const text = value.trim();
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>)
          .filter(([key, item]) => key.trim() && item !== undefined && item !== null && String(item).trim())
          .map(([key, item]) => [key.trim(), String(item).trim()])
      );
    }
  } catch {
    // Keep a simple KEY=VALUE per line format for operators.
  }

  return Object.fromEntries(
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...rest] = line.split('=');
        return [key.trim(), rest.join('=').trim()];
      })
      .filter(([key, item]) => key && item)
  );
}

function uniqueGpus(gpus: VastGpu[]) {
  const seen = new Set<string>();
  return gpus.filter((gpu) => {
    if (!gpu.v0Name || seen.has(gpu.v0Name)) {
      return false;
    }
    seen.add(gpu.v0Name);
    return true;
  });
}

function getInstanceName(instance: VastInstance) {
  return instance.attributes?.name || instance.name || instance.id || 'Unknown instance';
}

function getInstanceStatus(instance: VastInstance) {
  return instance.attributes?.status || instance.status || 'unknown';
}

function getInstanceStatusLabel(instance: VastInstance) {
  return instance.statusLabel || getInstanceStatus(instance);
}

function isInstanceFailed(instance: VastInstance) {
  const status = getInstanceStatus(instance).toLowerCase();
  const message = String(instance.statusMessage || instance.sourceStatus?.statusMessage || '').toLowerCase();
  return /failed|error|daemon|oci runtime|cdi devices|không tạo được/.test(`${status} ${message}`);
}

function isInstancePending(instance: VastInstance) {
  const status = getInstanceStatus(instance).toLowerCase();
  if (instance.connection?.ready) {
    return false;
  }

  if (isInstanceFailed(instance)) {
    return false;
  }

  return !['stopped', 'exited', 'deleted', 'destroyed', 'paused'].some((item) => status.includes(item));
}

function statusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('failed') || normalized.includes('error')) return 'danger';
  if (normalized.includes('creating') || normalized.includes('loading') || normalized.includes('not running')) return 'warning';
  if (normalized.includes('running')) return 'success';
  if (normalized.includes('stopping') || normalized.includes('starting')) return 'warning';
  if (normalized.includes('stop')) return 'muted';
  return 'info';
}

function buildLoadErrorMessage(message: string) {
  if (message.includes('Thiếu API key nguồn GPU') || message.includes('Thiếu VAST_API_KEY')) {
    return `${message}. Cần cấu hình API key nguồn GPU trên server rồi restart Next.js.`;
  }

  if (message.includes('HTTP 401') || message.includes('HTTP 403')) {
    return `${message}. API key nguồn GPU có thể sai, hết hạn hoặc thiếu quyền.`;
  }

  return message;
}

function normalizeUiErrorMessage(message: string) {
  if (/private key|public key|ssh public key|SSH public key|ssh-ed25519|ssh-rsa|Permission denied/i.test(message)) {
    return message;
  }

  if (/no_such_ask|not available|\/asks\/\d+|Instance type by id/i.test(message)) {
    return 'Gói GPU vừa hết hoặc không còn khả dụng. Mình đã làm mới danh sách, bạn chọn gói khác rồi tạo lại nhé.';
  }

  if (/HTTP\s+5\d\d|Something went wrong|Service Temporarily Unavailable/i.test(message)) {
    return 'Nguồn GPU đang bận hoặc chưa tạo được VPS lúc này. Hãy làm mới gói rồi thử lại.';
  }

  return message
    .replace(/API nguồn GPU\s+\/[^\s]+/gi, 'Nguồn GPU')
    .replace(/GPU API\s+\/[^\s]+/gi, 'Nguồn GPU')
    .replace(/Vast\.ai/gi, 'nguồn GPU')
    .replace(/\bVast\b/g, 'nguồn GPU')
    .replace(/\bvast\b/g, 'nguồn GPU');
}

function normalizePublicSshKeyInput(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function validatePublicSshKeyInput(value: string) {
  const key = normalizePublicSshKeyInput(value);
  if (!key) {
    return 'Bạn cần dán SSH public key trước khi tạo VPS.';
  }

  if (/BEGIN .*PRIVATE KEY/i.test(key) || key.includes('OPENSSH PRIVATE KEY')) {
    return 'Bạn đang dán private key. Chỉ dán public key trong file .pub.';
  }

  if (!/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)\s+[A-Za-z0-9+/]+={0,3}(\s+.+)?$/.test(key)) {
    return 'SSH public key chưa đúng định dạng. Key thường bắt đầu bằng ssh-ed25519 hoặc ssh-rsa.';
  }

  return '';
}

export function VpsGpuPage({ initialUser: _initialUser }: VpsGpuPageProps) {
  const { confirm } = useConfirmDialog();
  const { setBalances } = useWalletBalance();
  const [locations, setLocations] = useState<VastLocation[]>([]);
  const [hostnodes, setHostnodes] = useState<VastHostnode[]>([]);
  const [instances, setInstances] = useState<VastInstance[]>([]);
  const [pricingSettings, setPricingSettings] = useState<VpsGpuPricingSettings>(DEFAULT_VPS_GPU_PRICING);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [instanceAction, setInstanceAction] = useState<string | null>(null);

  const [offerType, setOfferType] = useState<OfferType>('ondemand');
  const [offerGpuFilter, setOfferGpuFilter] = useState('');
  const [minGpuRamGb, setMinGpuRamGb] = useState('16');
  const [minReliability, setMinReliability] = useState('0.98');
  const [offerSort, setOfferSort] = useState<OfferSort>('price-asc');
  const [searchingOffers, setSearchingOffers] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [deploymentMethod, setDeploymentMethod] = useState<DeploymentMethod>('hostnode');
  const [networkMode, setNetworkMode] = useState<NetworkMode>('port-forwarding');
  const [runtime, setRuntime] = useState<VastRuntime>(DEFAULT_VPS_GPU_IMAGE_PRESET.runtime);
  const [instanceName, setInstanceName] = useState('trungtammmo-gpu-ai');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedHostnodeId, setSelectedHostnodeId] = useState('');
  const [gpuV0Name, setGpuV0Name] = useState('RTX 4090');
  const [gpuCount, setGpuCount] = useState('1');
  const [vcpuCount, setVcpuCount] = useState('4');
  const [ramGb, setRamGb] = useState('16');
  const [storageGb, setStorageGb] = useState('200');
  const [imagePresetId, setImagePresetId] = useState(DEFAULT_VPS_GPU_IMAGE_PRESET.id);
  const [dockerImage, setDockerImage] = useState(DEFAULT_VPS_GPU_IMAGE_PRESET.image);
  const [targetState, setTargetState] = useState('running');
  const [envFlags, setEnvFlags] = useState(DEFAULT_VPS_GPU_IMAGE_PRESET.envFlags || '');
  const [onStartCommand, setOnStartCommand] = useState(DEFAULT_VPS_GPU_IMAGE_PRESET.onstart);
  const [cancelUnavailable, setCancelUnavailable] = useState(true);
  const [argsString, setArgsString] = useState(DEFAULT_VPS_GPU_IMAGE_PRESET.args || '');
  const [sshPublicKey, setSshPublicKey] = useState('');
  const [revealedPasswordId, setRevealedPasswordId] = useState<string | null>(null);

  async function loadOverview(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const response = await fetch('/api/vps-gpu?resource=overview', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse(response, 'Không thể tải dữ liệu VPS GPU');
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dữ liệu VPS GPU');
      }

      const data = asRecord(payload.data) as VastOverviewData;
      setLocations(extractLocations(data.locations));
      setHostnodes(extractHostnodes(data.hostnodes));
      setInstances(extractInstances(data.instances));
      const nextPricingSettings = asRecord(payload.data).pricingSettings as Partial<VpsGpuPricingSettings>;
      setPricingSettings({
        usdToVnd: Number(nextPricingSettings.usdToVnd) || DEFAULT_VPS_GPU_PRICING.usdToVnd,
        priceMultiplier: Number(nextPricingSettings.priceMultiplier) || DEFAULT_VPS_GPU_PRICING.priceMultiplier,
        hourlyFeeVnd: Number(nextPricingSettings.hourlyFeeVnd) || DEFAULT_VPS_GPU_PRICING.hourlyFeeVnd,
      });
      setDockerImage((current) => current || DEFAULT_VPS_GPU_IMAGE_PRESET.image);
      setLoadError(payload.message ? String(payload.message) : null);
    } catch (error) {
      const message = normalizeUiErrorMessage(error instanceof Error ? error.message : 'Không thể tải dữ liệu VPS GPU');
      setLoadError(message);
      if (!options?.silent) {
        toast.error(message);
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const hasPendingInstances = useMemo(() => instances.some(isInstancePending), [instances]);

  useEffect(() => {
    if (!hasPendingInstances) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadOverview({ silent: true });
    }, 8000);

    return () => window.clearInterval(timer);
  }, [hasPendingInstances]);

  async function searchOffers() {
    setSearchingOffers(true);
    try {
      const response = await fetch('/api/vps-gpu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search-offers',
          payload: {
            gpuName: offerGpuFilter.trim() || undefined,
            minGpus: gpuCount,
            minGpuRamMb: Math.max(0, Number(minGpuRamGb) || 0) * 1024,
            minDiskGb: Math.max(100, parsePositiveInt(storageGb, 100)),
            maxHourlyUsd: 0.5,
            minReliability,
            type: offerType,
            limit: 80,
          },
        }),
      });
      const payload = await readJsonResponse(response, 'Không thể tìm gói GPU');
      if (!payload.success) {
        throw new Error(payload.message || 'Không thể tìm gói GPU');
      }
      const nextHostnodes = toArray<VastHostnode>(asRecord(payload.data).hostnodes).filter(isVerifiedHostnode);
      const nextPricingSettings = asRecord(payload.data).pricingSettings as Partial<VpsGpuPricingSettings>;
      setPricingSettings({
        usdToVnd: Number(nextPricingSettings.usdToVnd) || DEFAULT_VPS_GPU_PRICING.usdToVnd,
        priceMultiplier: Number(nextPricingSettings.priceMultiplier) || DEFAULT_VPS_GPU_PRICING.priceMultiplier,
        hourlyFeeVnd: Number(nextPricingSettings.hourlyFeeVnd) || DEFAULT_VPS_GPU_PRICING.hourlyFeeVnd,
      });
      setHostnodes(nextHostnodes);
      const nextHostnodeId = nextHostnodes[0]?.id || '';
      if (nextHostnodeId) {
        setSelectedHostnodeId(nextHostnodeId);
        const nextGpu = nextHostnodes[0]?.available_resources?.gpus?.[0]?.v0Name;
        if (nextGpu) {
          setGpuV0Name(nextGpu);
        }
      }
      toast.success(`Đã tải ${nextHostnodes.length} gói GPU`);
    } catch (error) {
      toast.error(normalizeUiErrorMessage(error instanceof Error ? error.message : 'Không thể tìm gói GPU'));
    } finally {
      setSearchingOffers(false);
    }
  }

  const selectedHostnode = useMemo(
    () => hostnodes.find((item) => item.id === selectedHostnodeId) || hostnodes[0] || null,
    [hostnodes, selectedHostnodeId]
  );

  const sortedHostnodes = useMemo(() => {
    return [...hostnodes].sort((left, right) => {
      const leftPrice = getHostnodeSalePrice(left);
      const rightPrice = getHostnodeSalePrice(right);
      const leftMissing = leftPrice <= 0;
      const rightMissing = rightPrice <= 0;
      if (leftMissing && rightMissing) return 0;
      if (leftMissing) return 1;
      if (rightMissing) return -1;
      const diff = leftPrice - rightPrice;
      return offerSort === 'price-asc' ? diff : -diff;
    });
  }, [hostnodes, offerSort]);

  const lowestSaleHourly = useMemo(() => {
    const prices = hostnodes
      .map((hostnode) => getHostnodeSalePrice(hostnode))
      .filter((price) => Number.isFinite(price) && price > 0);
    return prices.length ? Math.min(...prices) : 0;
  }, [hostnodes]);

  const selectedLocation = useMemo(
    () =>
      locations.find((item) => item.id === selectedLocationId) ||
      locations.find((location) => location.id === selectedHostnode?.location_id || location.id === selectedHostnode?.location?.country) ||
      locations[0] ||
      null,
    [locations, selectedHostnode, selectedLocationId]
  );

  const gpuOptions = useMemo(() => {
    const scopedGpus =
      deploymentMethod === 'hostnode'
        ? selectedHostnode?.available_resources?.gpus || []
        : selectedLocation?.gpus || [];
    const fallbackGpus = [
      ...locations.flatMap((location) => location.gpus || []),
      ...hostnodes.flatMap((hostnode) => hostnode.available_resources?.gpus || []),
    ];

    const options = uniqueGpus([...scopedGpus, ...fallbackGpus]);
    return options.length
      ? options
      : [
          {
            v0Name: 'geforcertx4090-pcie-24gb',
            displayName: 'NVIDIA GeForce RTX 4090 PCIe 24GB',
            price_per_hr: 0.5,
          },
        ];
  }, [deploymentMethod, hostnodes, locations, selectedHostnode, selectedLocation]);

  const selectedGpu = useMemo(
    () => gpuOptions.find((gpu) => gpu.v0Name === gpuV0Name) || gpuOptions[0],
    [gpuOptions, gpuV0Name]
  );

  useEffect(() => {
    if (!selectedLocationId && locations[0]?.id) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  useEffect(() => {
    if (!selectedHostnodeId && hostnodes[0]?.id) {
      setSelectedHostnodeId(hostnodes[0].id);
    }
  }, [hostnodes, selectedHostnodeId]);

  useEffect(() => {
    if (deploymentMethod !== 'hostnode') {
      return;
    }

    const currentHostnode = hostnodes.find((hostnode) => hostnode.id === selectedHostnodeId);
    const nextGpu = currentHostnode?.available_resources?.gpus?.[0]?.v0Name;
    if (nextGpu && nextGpu !== gpuV0Name) {
      setGpuV0Name(nextGpu);
    }
  }, [deploymentMethod, gpuV0Name, hostnodes, selectedHostnodeId]);

  useEffect(() => {
    if (!gpuOptions.some((gpu) => gpu.v0Name === gpuV0Name) && gpuOptions[0]?.v0Name) {
      setGpuV0Name(gpuOptions[0].v0Name);
    }
  }, [gpuOptions, gpuV0Name]);

  const selectedImagePreset = getVpsGpuImagePreset(imagePresetId);

  function applyImagePreset(presetId: string) {
    const preset = getVpsGpuImagePreset(presetId);
    setImagePresetId(preset.id);
    setDockerImage(preset.image);
    setRuntime(preset.runtime);
    setOnStartCommand(preset.onstart);
    setArgsString(preset.args || '');
    setEnvFlags(preset.envFlags || '');
  }

  function buildPayload() {
    const name = instanceName.trim();
    const gpuName = gpuV0Name.trim();
    const vcpus = parsePositiveInt(vcpuCount, 4);
    const ram = parsePositiveInt(ramGb, 16);
    const storage = Math.max(100, parsePositiveInt(storageGb, 200));
    const gpus = Math.max(1, parsePositiveInt(gpuCount, 1));

    if (!name) {
      throw new Error('Thiếu tên VPS GPU');
    }

    if (!gpuName) {
      throw new Error('Thiếu GPU model');
    }

    const normalizedSshPublicKey = normalizePublicSshKeyInput(sshPublicKey);
    const sshKeyError = runtime === 'ssh'
      ? validatePublicSshKeyInput(normalizedSshPublicKey)
      : normalizedSshPublicKey
        ? validatePublicSshKeyInput(normalizedSshPublicKey)
        : '';
    if (sshKeyError) {
      throw new Error(sshKeyError);
    }

    const attributes: Record<string, unknown> = {
      name,
      type: 'virtualmachine',
      image: dockerImage.trim() || DEFAULT_VPS_GPU_IMAGE_PRESET.image,
      runtype: runtime,
      target_state: targetState,
      cancel_unavail: cancelUnavailable,
      onstart: onStartCommand.trim() || selectedImagePreset.onstart,
      python_utf8: true,
      lang_utf8: true,
      use_jupyter_lab: runtime === 'jupyter',
      env: parseEnvObject(envFlags),
      resources: {
        vcpu_count: vcpus,
        ram_gb: ram,
        storage_gb: storage,
        gpus: {
          [gpuName]: {
            count: gpus,
          },
        },
      },
    };

    if (normalizedSshPublicKey) {
      attributes.ssh_public_key = normalizedSshPublicKey;
    }

    if (deploymentMethod === 'location') {
      const locationId = selectedLocation?.id || selectedLocationId;
      if (!locationId) {
        throw new Error('Thiếu khu vực');
      }
      attributes.location_id = locationId;
      const locationHostnode = hostnodes.find(
        (hostnode) =>
          (hostnode.location_id === locationId || hostnode.location?.country === locationId) &&
          hostnode.available_resources?.gpus?.some((gpu) => gpu.v0Name === gpuName)
      ) || hostnodes.find((hostnode) => hostnode.location_id === locationId || hostnode.location?.country === locationId);
      const offerId = locationHostnode?.id || selectedHostnode?.id || selectedHostnodeId;
      if (!offerId) {
        throw new Error('Không tìm thấy gói GPU trong khu vực đã chọn');
      }
      attributes.offer_id = offerId;
    } else {
      const hostnodeId = selectedHostnode?.id || selectedHostnodeId;
      if (!hostnodeId) {
        throw new Error('Thiếu gói GPU');
      }
      attributes.hostnode_id = hostnodeId;
      attributes.offer_id = hostnodeId;
    }

    if (networkMode === 'dedicated-ip') {
      attributes.useDedicatedIp = true;
    }

    if (argsString.trim()) {
      attributes.args_str = argsString.trim();
    }

    return {
      data: {
        type: 'virtualmachine',
        attributes,
      },
    };
  }

  const estimatedHourly = useMemo(() => {
    const hostnodeHourly = Number(selectedHostnode?.pricing?.total_hourly || 0);
    if (Number.isFinite(hostnodeHourly) && hostnodeHourly > 0) {
      return hostnodeHourly;
    }

    const gpuPrice = Number(selectedGpu?.price_per_hr || 0) * parsePositiveInt(gpuCount, 1);
    const perVcpu =
      selectedGpu?.pricing?.per_vcpu_hr ||
      selectedHostnode?.pricing?.per_vcpu_hr ||
      0;
    const perRam =
      selectedGpu?.pricing?.per_gb_ram_hr ||
      selectedHostnode?.pricing?.per_gb_ram_hr ||
      0;
    const perStorage =
      selectedGpu?.pricing?.per_gb_storage_hr ||
      selectedHostnode?.pricing?.per_gb_storage_hr ||
      0;

    return (
      gpuPrice +
      perVcpu * parsePositiveInt(vcpuCount, 4) +
      perRam * parsePositiveInt(ramGb, 16) +
      perStorage * Math.max(100, parsePositiveInt(storageGb, 200))
    );
  }, [gpuCount, ramGb, selectedGpu, selectedHostnode, storageGb, vcpuCount]);

  const estimatedSaleHourly = useMemo(() => {
    const hostnodeSale = getHostnodeSalePrice(selectedHostnode);
    if (hostnodeSale > 0) {
      return hostnodeSale;
    }

    return computeSaleHourlyFromUsd(estimatedHourly, pricingSettings);
  }, [estimatedHourly, pricingSettings, selectedHostnode]);

  const normalizedSshPublicKey = useMemo(() => normalizePublicSshKeyInput(sshPublicKey), [sshPublicKey]);
  const sshPublicKeyError = useMemo(
    () => (normalizedSshPublicKey ? validatePublicSshKeyInput(normalizedSshPublicKey) : ''),
    [normalizedSshPublicKey]
  );
  const sshPublicKeyReady = Boolean(normalizedSshPublicKey && !sshPublicKeyError);

  function openCreateDialog() {
    try {
      buildPayload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payload chưa hợp lệ');
      return;
    }

    setTermsAccepted(false);
    setCreateDialogOpen(true);
  }

  async function handleCreateInstance() {
    if (!termsAccepted) {
      toast.error('Bạn cần đồng ý điều khoản thuê VPS GPU trước khi tạo.');
      return;
    }

    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payload chưa hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/vps-gpu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-instance',
          payload,
        }),
      });
      const result = await readJsonResponse(response, 'Không thể tạo VPS GPU');
      if (!response.ok || !result.success) {
        if (asRecord(result).staleOffer) {
          void searchOffers();
        }
        throw new Error(result.message || 'Không thể tạo VPS GPU');
      }
      const nextBalance = Number(asRecord(asRecord(result).data).balance);
      if (Number.isFinite(nextBalance)) {
        setBalances({ balance: nextBalance });
      }
      toast.success('Đã tạo VPS GPU và trừ tiền vào ví chính');
      setCreateDialogOpen(false);
      await loadOverview();
    } catch (error) {
      toast.error(normalizeUiErrorMessage(error instanceof Error ? error.message : 'Không thể tạo VPS GPU'));
    } finally {
      setSubmitting(false);
    }
  }

  async function runInstanceAction(action: 'start' | 'stop' | 'delete', instanceId: string) {
    if (action === 'delete') {
      const confirmed = await confirm({
        title: 'Xóa instance VPS GPU',
        description: `Instance ${instanceId} sẽ bị xóa khỏi hệ thống GPU. Thao tác này không thể hoàn tác.`,
        confirmText: 'Xóa instance',
        cancelText: 'Hủy',
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    setInstanceAction(`${action}:${instanceId}`);
    try {
      const response = await fetch('/api/vps-gpu', {
        method: action === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'delete'
            ? { instanceId }
            : { action: `instances/${instanceId}/${action}` }
        ),
      });
      const result = await readJsonResponse(response, 'Thao tác instance thất bại');
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Thao tác instance thất bại');
      }
      toast.success('Đã gửi lệnh tới hệ thống GPU');
      await loadOverview();
    } catch (error) {
      toast.error(normalizeUiErrorMessage(error instanceof Error ? error.message : 'Thao tác instance thất bại'));
    } finally {
      setInstanceAction(null);
    }
  }

  async function copyConnectionCommand(command: string) {
    if (!command) {
      toast.error('VPS chưa có lệnh kết nối');
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      toast.success('Đã sao chép lệnh SSH');
    } catch {
      toast.error('Không thể sao chép, hãy copy thủ công');
    }
  }

  async function copyText(value: string | undefined, successMessage: string) {
    if (!value) {
      toast.error('Chưa có dữ liệu để sao chép');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Không thể sao chép, hãy copy thủ công');
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {createDialogOpen ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl animate-in zoom-in-95 fade-in duration-200 rounded-[1.6rem] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_30px_120px_-40px_rgba(14,165,233,0.75)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Xác nhận thuê VPS GPU
                </div>
                <h2 className="mt-4 text-2xl font-black uppercase leading-tight sm:text-3xl">Bạn có chắc chắn tạo VPS này?</h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-300">
                  Instance <span className="font-black text-white">{instanceName.trim()}</span> sẽ trừ{' '}
                  <span className="font-mono font-black text-emerald-300">{formatMoneyVnd(estimatedSaleHourly)}</span> từ ví chính cho giờ đầu tiên.
                  Sau đó hệ thống gia hạn theo giờ và tự dừng VPS khi ví chính không đủ tiền duy trì.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
                Đóng
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniInfo icon={<Cpu />} label="Gói GPU" value={getHostnodeGpuLabel(selectedHostnode)} />
              <MiniInfo icon={<MapPin />} label="Khu vực" value={formatLocation(selectedHostnode?.location)} />
              <MiniInfo icon={<Database />} label="RAM" value={formatGb(selectedHostnode?.available_resources?.ram_gb || ramGb)} />
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-[1.1rem] border border-amber-400/25 bg-amber-500/10 p-4 text-sm font-semibold leading-7 text-amber-50">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-amber-300 text-brand-blue focus:ring-brand-blue"
              />
              <span>
                Tôi đồng ý điều khoản thuê VPS GPU: giá tính theo giờ và trừ từ ví chính{runtime === 'ssh' ? ', phải dán đúng SSH public key' : ''}, dữ liệu có thể mất khi VPS bị xóa hoặc gói GPU lỗi,
                và hệ thống được quyền tự xóa VPS nếu ví chính không đủ tiền gia hạn.
              </span>
            </label>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
                Kiểm tra lại
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreateInstance()}
                disabled={!termsAccepted || submitting}
                loading={submitting}
                loadingText="Đang tạo..."
              >
                Đồng ý và tạo VPS
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <PageHero
        eyebrow="GPU Cloud"
        title="Thuê VPS GPU mạnh cho AI, game và render"
        description="Chọn gói GPU thật, xem giá bán theo VNĐ và tạo VPS GPU bằng tài khoản vận hành của hệ thống."
        actions={
          <>
            <Button type="button" onClick={() => void loadOverview()} disabled={loading} variant="outline">
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Làm mới gói
            </Button>
            <Button type="button" onClick={openCreateDialog} loading={submitting} loadingText="Đang tạo...">
              <Cpu className="mr-2 h-4 w-4" />
              Tạo VPS GPU
            </Button>
          </>
        }
        stats={[
          { label: 'Khu vực', value: String(locations.length), hint: 'Nơi có GPU khả dụng', tone: 'blue' },
          { label: 'Gói GPU', value: String(hostnodes.length), hint: 'Gói đang có thể thuê', tone: 'emerald' },
          { label: 'Instances', value: String(instances.length), hint: 'VM đang quản lý', tone: 'violet' },
          { label: 'Giá chỉ từ', value: formatMoneyVnd(lowestSaleHourly || estimatedSaleHourly), hint: '/ giờ', tone: 'amber' },
        ]}
      >
        {runtime === 'ssh' ? (
          <div className="max-w-3xl rounded-[1.2rem] border border-brand-blue/20 bg-slate-950/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-white/[0.035] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">SSH public key của bạn</div>
                <p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-300">
                  Dán public key của máy bạn vào đây trước khi tạo VPS để đăng nhập được bằng SSH.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('vps-gpu-ssh-guide')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Xem cách lấy key
              </Button>
            </div>
            <textarea
              value={sshPublicKey}
              onChange={(event) => setSshPublicKey(event.target.value)}
              rows={4}
              placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... ten-may-cua-ban"
              className="field-elevated mt-4 w-full rounded-[1.2rem] px-4 py-3 font-mono text-xs font-semibold leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
            />
            <div className="mt-3 flex flex-col gap-2 text-xs font-semibold leading-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-500 dark:text-slate-400">
                Chỉ dán nội dung file <span className="font-mono font-black">.pub</span>. Không dán private key, mật khẩu hoặc file id_ed25519/id_rsa.
              </p>
              {sshPublicKeyReady ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-black text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Key hợp lệ
                </span>
              ) : sshPublicKeyError ? (
                <span className="font-black text-amber-500">{sshPublicKeyError}</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </PageHero>

      {loadError ? (
        <SectionPanel className="border-amber-500/25 bg-amber-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">Nguồn GPU chưa sẵn sàng</div>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                {buildLoadErrorMessage(loadError)}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadOverview()}>
              Thử lại
            </Button>
          </div>
        </SectionPanel>
      ) : null}

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Bảng giá GPU"
          title="Chọn gói GPU trước khi tạo VPS"
          description="Lọc theo dòng GPU, RAM và độ ổn định. Giá hiển thị là giá thuê mỗi giờ đã quy đổi sang VNĐ."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className="rounded-full">
                {sortedHostnodes.length} gói
              </Badge>
              <Button type="button" onClick={() => void searchOffers()} loading={searchingOffers} loadingText="Đang lọc...">
                <RefreshCw className="mr-2 h-4 w-4" />
                Lọc gói
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-5">
          <Field label="Loại thuê">
            <select
              value={offerType}
              onChange={(event) => setOfferType(event.target.value as OfferType)}
              className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
            >
              <option value="ondemand">Ondemand</option>
              <option value="bid">Bid</option>
            </select>
          </Field>
          <Field label="Tên GPU">
            <Input value={offerGpuFilter} onChange={(event) => setOfferGpuFilter(event.target.value)} placeholder="RTX 4090 / A100..." />
          </Field>
          <Field label="GPU RAM tối thiểu">
            <Input type="number" min={1} value={minGpuRamGb} onChange={(event) => setMinGpuRamGb(event.target.value)} />
          </Field>
          <Field label="Độ ổn định">
            <Input type="number" min={0} max={1} step={0.01} value={minReliability} onChange={(event) => setMinReliability(event.target.value)} />
          </Field>
          <Field label="Sắp xếp">
            <select
              value={offerSort}
              onChange={(event) => setOfferSort(event.target.value as OfferSort)}
              className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
            >
              <option value="price-asc">Giá thấp đến cao</option>
              <option value="price-desc">Giá cao đến thấp</option>
            </select>
          </Field>
        </div>

        {loading ? (
          <EmptyState title="Đang tải gói GPU" description="Hệ thống đang tải gói GPU và các VPS đang chạy." icon={<Loader2 className="h-5 w-5 animate-spin" />} />
        ) : hostnodes.length ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {sortedHostnodes.map((hostnode) => {
              const active = String(hostnode.id) === String(selectedHostnode?.id || selectedHostnodeId);
              const gpu = getHostnodeGpu(hostnode);
              const offer = asRecord(hostnode.vast);
              const salePrice = getHostnodeSalePrice(hostnode);
              const gpuRamGb = (Number(offer.gpu_ram || 0) || 0) / 1024 || gpu?.resources?.max_ram_gb;
              const ramValue = hostnode.available_resources?.ram_gb || Number(offer.cpu_ram || 0) / 1024;
              const diskValue = hostnode.available_resources?.storage_gb || Number(offer.disk_space || offer.disk_bw || 0);
              const networkValue = offer.inet_down || offer.net_down || Number(hostnode.location?.network_speed_gbps || 0) * 1000;
              const cpuValue = normalizeOfferText(offer.cpu_name || offer.cpu_cores_effective || offer.cpu_cores || hostnode.available_resources?.vcpu_count, 'CPU');
              const reliabilityValue = offer.reliability2 || offer.reliability || hostnode.uptime_percentage;
              return (
                <button
                  key={hostnode.id}
                  type="button"
                  onClick={() => {
                    setDeploymentMethod('hostnode');
                    setSelectedHostnodeId(hostnode.id);
                    if (gpu?.v0Name) setGpuV0Name(gpu.v0Name);
                    if (hostnode.available_resources?.vcpu_count) setVcpuCount(String(hostnode.available_resources.vcpu_count));
                    if (hostnode.available_resources?.ram_gb) setRamGb(String(Math.max(8, Math.round(hostnode.available_resources.ram_gb))));
                    if (hostnode.available_resources?.storage_gb) setStorageGb(String(Math.max(100, Math.round(hostnode.available_resources.storage_gb))));
                  }}
                  className={cn(
                    'min-w-0 rounded-[1.2rem] border p-4 text-left transition-all',
                    active
                      ? 'border-brand-blue/45 bg-brand-blue/10 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]'
                      : 'border-slate-200/80 bg-white/70 hover:border-brand-blue/25 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.26em] text-brand-blue">Gói #{hostnode.id}</div>
                      <div className="mt-2 line-clamp-2 text-base font-black leading-tight text-slate-950 dark:text-white">{getHostnodeGpuLabel(hostnode)}</div>
                    </div>
                    <Badge variant={active ? 'default' : 'success'} className="shrink-0 rounded-full whitespace-nowrap">
                      Verified
                    </Badge>
                  </div>

                  <div className="mt-4 rounded-[1rem] border border-brand-blue/15 bg-brand-blue/10 p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.24em] text-brand-blue">Giá thuê</div>
                    <div className="mt-1 break-words font-mono text-2xl font-black leading-tight tabular-nums text-slate-950 dark:text-white">
                      {formatMoneyVnd(salePrice)}
                      <span className="ml-1 text-sm font-black text-slate-500 dark:text-slate-400">/ giờ</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                    <MiniInfo icon={<Cpu />} label="GPU RAM" value={formatGb(gpuRamGb)} />
                    <MiniInfo icon={<ShieldCheck />} label="Độ ổn định" value={formatPercent(reliabilityValue)} />
                    <MiniInfo icon={<Database />} label="RAM" value={formatGb(ramValue)} />
                    <MiniInfo icon={<Network />} label="Network" value={formatMbps(networkValue)} />
                    <MiniInfo icon={<Cpu />} label="CPU" value={cpuValue} />
                    <MiniInfo icon={<HardDrive />} label="SSD" value={formatGb(diskValue)} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{formatLocation(hostnode.location)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Chưa có gói phù hợp" description="Thử giảm điều kiện GPU RAM, độ ổn định hoặc bỏ lọc tên GPU." icon={<Cpu className="h-5 w-5" />} />
        )}
      </SectionPanel>

      <div>
        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Cấu hình VPS"
            title="Cấu hình instance"
            description="Giữ các thông tin cần thiết để tạo VPS GPU: gói GPU, tài nguyên, image hệ thống và lệnh khởi động."
          />

          <div className="space-y-7">
            <ChoiceGroup
              title="Kết nối"
              options={networkOptions}
              value={networkMode}
              onChange={setNetworkMode}
            />
            <ChoiceGroup
              title="Môi trường chạy"
              options={runtimeOptions}
              value={runtime}
              onChange={setRuntime}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên instance">
              <Input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} />
            </Field>

            <Field label={deploymentMethod === 'location' ? 'Khu vực' : 'Gói GPU'}>
              {deploymentMethod === 'location' ? (
                <select
                  value={selectedLocation?.id || selectedLocationId}
                  onChange={(event) => setSelectedLocationId(event.target.value)}
                  className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {formatLocation(location)} · Tier {location.tier || '?'}
                    </option>
                  ))}
                  {!locations.length ? <option value="">Chưa có location</option> : null}
                </select>
              ) : (
                <select
                  value={selectedHostnode?.id || selectedHostnodeId}
                  onChange={(event) => setSelectedHostnodeId(event.target.value)}
                  className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
                >
                  {hostnodes.map((hostnode) => (
                    <option key={hostnode.id} value={hostnode.id}>
                      #{hostnode.id} · {hostnode.engine || 'Gói GPU'} · {formatLocation(hostnode.location)}
                    </option>
                  ))}
                  {!hostnodes.length ? <option value="">Chưa có hostnode</option> : null}
                </select>
              )}
            </Field>

            <Field label="Dòng GPU">
              <select
                value={selectedGpu?.v0Name || gpuV0Name}
                onChange={(event) => setGpuV0Name(event.target.value)}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
              >
                {gpuOptions.map((gpu) => (
                  <option key={gpu.v0Name} value={gpu.v0Name}>
                    {gpu.displayName || gpu.v0Name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Số GPU">
              <Input min={1} type="number" value={gpuCount} onChange={(event) => setGpuCount(event.target.value)} />
            </Field>

            <Field label="vCPU">
              <Input min={2} step={2} type="number" value={vcpuCount} onChange={(event) => setVcpuCount(event.target.value)} />
            </Field>

            <Field label="RAM GB">
              <select
                value={ramGb}
                onChange={(event) => setRamGb(event.target.value)}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
              >
                {ramSteps.map((step) => (
                  <option key={step} value={step}>
                    {step} GB
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ổ đĩa GB">
              <Input min={100} step={50} type="number" value={storageGb} onChange={(event) => setStorageGb(event.target.value)} />
            </Field>

            <Field label="Hệ điều hành / môi trường">
              <select
                value={imagePresetId}
                onChange={(event) => applyImagePreset(event.target.value)}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
              >
                {vpsGpuImagePresets.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} - {option.category}
                  </option>
                ))}
              </select>
              <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                {selectedImagePreset.hint}
              </p>
            </Field>

            <Field label="Image Docker public">
              <Input value={dockerImage} readOnly className="font-mono text-xs" />
            </Field>

            <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
              <MetricCard
                label="Nhu cầu"
                value={selectedImagePreset.category.replace(' / Desktop', '').replace(' / Render', '')}
                hint={selectedImagePreset.recommended ? 'Preset khuyến nghị' : 'Preset public đã kiểm tra'}
                tone="blue"
                icon={<Sparkles className="h-4 w-4" />}
                className="min-w-0 p-4 [&_*]:min-w-0 [&_[class*='text-3xl']]:break-words [&_[class*='text-3xl']]:text-2xl [&_[class*='text-3xl']]:leading-tight"
              />
              <MetricCard
                label="Remote desktop"
                value={selectedImagePreset.remote.replace('WebRTC/HTML5 port 8080', 'WebRTC 8080')}
                hint="Khi VPS ready, xem port trong card VPS"
                tone="emerald"
                icon={<Monitor className="h-4 w-4" />}
                className="min-w-0 p-4 [&_*]:min-w-0 [&_[class*='text-3xl']]:break-words [&_[class*='text-3xl']]:text-2xl [&_[class*='text-3xl']]:leading-tight"
              />
              <MetricCard
                label="Nguồn image"
                value="Public"
                hint="Không dùng image cần đăng nhập Docker"
                tone="violet"
                icon={<ShieldCheck className="h-4 w-4" />}
                className="min-w-0 p-4 [&_*]:min-w-0 [&_[class*='text-3xl']]:break-words [&_[class*='text-3xl']]:text-2xl [&_[class*='text-3xl']]:leading-tight"
              />
            </div>

            <Field label="Trạng thái sau tạo">
              <select
                value={targetState}
                onChange={(event) => setTargetState(event.target.value)}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
              >
                <option value="running">Running sau khi tạo</option>
                <option value="stopped">Tạo nhưng để stopped</option>
              </select>
            </Field>

            {runtime === 'args' ? (
              <MetricCard
                label="Entrypoint Docker"
                value="Giữ nguyên"
                hint="Image tự bật web desktop/app theo entrypoint gốc"
                tone="emerald"
                icon={<Play className="h-4 w-4" />}
                className="p-4"
              />
            ) : (
              <Field label="Lệnh khởi động">
                <Input value={onStartCommand} onChange={(event) => setOnStartCommand(event.target.value)} placeholder="nvidia-smi" />
              </Field>
            )}

            {networkMode === 'port-forwarding' ? (
              <MetricCard
                label="Map port"
                value="Public"
                hint="Mở bằng public mapped port, không mở trực tiếp 3000/3001"
                tone="blue"
                icon={<Network className="h-4 w-4" />}
                className="p-4"
              />
            ) : (
              <MetricCard
                label="Dedicated IP"
                value="Enabled"
                hint="Hệ thống GPU sẽ trả thông tin SSH/public IP khi instance sẵn sàng"
                tone="blue"
                icon={<ShieldCheck className="h-4 w-4" />}
                className="p-4"
              />
            )}

            {runtime === 'ssh' ? (
              <MetricCard
                label="SSH public key"
                value={sshPublicKeyReady ? 'Đã sẵn sàng' : 'Chưa có key'}
                hint={sshPublicKeyReady ? 'Hệ thống sẽ gắn key này vào VPS khi tạo.' : 'Dán key ở ô ngay dưới nút Tạo VPS GPU phía trên.'}
                tone={sshPublicKeyReady ? 'emerald' : 'amber'}
                icon={<KeyRound className="h-4 w-4" />}
                className="p-4"
              />
            ) : (
              <Field label="Args tùy chọn">
                <Input
                  value={argsString}
                  onChange={(event) => setArgsString(event.target.value)}
                  placeholder="Để trống để image tự dùng CMD mặc định"
                />
              </Field>
            )}
          </div>

          <Field label="Biến môi trường">
            <textarea
              value={envFlags}
              onChange={(event) => setEnvFlags(event.target.value)}
              rows={5}
              placeholder={'HF_TOKEN=...\nMODEL_ID=...'}
              className="field-elevated w-full rounded-[1.2rem] px-4 py-3 font-mono text-xs font-semibold leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
            />
          </Field>

          <label className="flex items-center gap-3 rounded-[1rem] border border-slate-200/80 bg-white/70 p-4 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
            <input
              type="checkbox"
              checked={cancelUnavailable}
              onChange={(event) => setCancelUnavailable(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            Hủy lệnh nếu gói đã hết thuê được khi gửi request
          </label>
        </SectionPanel>
      </div>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Quản lý VPS"
          title="VPS GPU đang chạy"
          description="Theo dõi kết nối, giá thuê và gửi lệnh start, stop hoặc delete. Phí thuê được tính theo từng giờ."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Làm mới
            </Button>
          }
        />

        {loading ? (
          <EmptyState title="Đang tải VPS GPU" description="Hệ thống đang lấy gói GPU và danh sách VPS đang chạy." icon={<Loader2 className="h-5 w-5 animate-spin" />} />
        ) : instances.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {instances.map((instance) => {
              const id = instance.id || '';
              const status = getInstanceStatus(instance);
              const ready = Boolean(instance.connection?.ready);
              const pending = isInstancePending(instance);
              const failed = isInstanceFailed(instance);
              const specs = instance.specs || {};
              const connection = instance.connection || {};
              const billing = instance.billing || null;
              const webDesktopLinks: WebDesktopLink[] = connection.webDesktopUrls?.length
                ? connection.webDesktopUrls
                : connection.webDesktopUrl
                  ? [{
                      internalPort: connection.webDesktopInternalPort,
                      publicPort: connection.webDesktopPort,
                      url: connection.webDesktopUrl,
                      label: connection.webDesktopInternalPort
                        ? `Port ${connection.webDesktopInternalPort}`
                        : 'Remote',
                      primary: true,
                    }]
                  : [];
              const primaryWebDesktopLink = webDesktopLinks[0];
              return (
                <Card key={id || getInstanceName(instance)} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{getInstanceName(instance)}</CardTitle>
                        <CardDescription className="mt-2 font-mono text-xs">{id || 'No ID'}</CardDescription>
                      </div>
                      <Badge variant={statusVariant(status)} className="shrink-0 rounded-full">
                        {getInstanceStatusLabel(instance)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ready ? (
                      <div className="rounded-[1rem] border border-emerald-400/30 bg-emerald-500/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-black text-emerald-600 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" />
                            VPS đã sẵn sàng kết nối
                          </div>
                          {connection.command ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyConnectionCommand(connection.command || '')}
                            >
                              <Clipboard className="mr-2 h-4 w-4" />
                              Copy SSH
                            </Button>
                          ) : null}
                        </div>
                        {connection.command ? (
                          <div className="mt-3 overflow-x-auto rounded-[0.9rem] border border-emerald-300/20 bg-slate-950/90 px-3 py-2 font-mono text-xs font-bold text-cyan-100">
                            {connection.command}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className={cn(
                        'rounded-[1rem] border p-4',
                        failed
                          ? 'border-red-400/30 bg-red-500/10'
                          : 'border-amber-400/25 bg-amber-500/10'
                      )}>
                        <div className={cn(
                          'flex items-center gap-2 text-sm font-black',
                          failed ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'
                        )}>
                          <Loader2 className={cn('h-4 w-4', pending && !failed && 'animate-spin')} />
                          {failed
                            ? 'Nguồn GPU không tạo được VPS này'
                            : pending
                              ? 'VPS đang cài đặt, trang sẽ tự cập nhật mỗi 8 giây'
                              : 'VPS chưa có thông tin kết nối'}
                        </div>
                        {instance.statusMessage ? (
                          <p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-300">
                            {instance.statusMessage}
                          </p>
                        ) : null}
                      </div>
                    )}

                    {billing?.lowBalanceWarningForAtMs || billing?.lowBalanceWarningForAt ? (
                      <div className="rounded-[1rem] border border-amber-400/30 bg-amber-500/10 p-4">
                        <div className="text-sm font-black text-amber-600 dark:text-amber-300">
                          Ví chính chưa đủ cho lần gia hạn tiếp theo
                        </div>
                        <p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-300">
                          Hệ thống đã gửi email nhắc nạp. Nếu trước {formatDateTime(billing.lowBalanceWarningForAtMs ?? billing.lowBalanceWarningForAt)} theo giờ Việt Nam ví chính vẫn chưa đủ {formatMoneyVnd(billing.saleHourlyVnd)}, VPS sẽ tự động bị xóa để tránh phát sinh chi phí.
                        </p>
                      </div>
                    ) : null}

                    {connection.rdpAddress ? (
                      <div className="rounded-[1rem] border border-sky-400/25 bg-sky-500/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-black text-sky-700 dark:text-sky-200">
                            <Monitor className="h-4 w-4" />
                            Remote Desktop có thể kết nối
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copyText(connection.rdpCommand || connection.rdpAddress, 'Đã sao chép lệnh Remote Desktop')}
                          >
                            <Clipboard className="mr-2 h-4 w-4" />
                            Copy RDP
                          </Button>
                        </div>
                        <div className="mt-3 overflow-x-auto rounded-[0.9rem] border border-sky-300/20 bg-slate-950/90 px-3 py-2 font-mono text-xs font-bold text-cyan-100">
                          {connection.rdpCommand || connection.rdpAddress}
                        </div>
                      </div>
                    ) : null}

                    {primaryWebDesktopLink ? (
                      <div className="rounded-[1rem] border border-cyan-400/25 bg-cyan-500/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-black text-cyan-700 dark:text-cyan-200">
                            <Monitor className="h-4 w-4" />
                            Web desktop / app port đã map public
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(primaryWebDesktopLink.url, '_blank', 'noopener,noreferrer')}
                            >
                              Mở remote
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText(primaryWebDesktopLink.url, 'Đã sao chép link remote')}
                            >
                              <Clipboard className="mr-2 h-4 w-4" />
                              Copy link
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 overflow-x-auto rounded-[0.9rem] border border-cyan-300/20 bg-slate-950/90 px-3 py-2 font-mono text-xs font-bold text-cyan-100">
                          {primaryWebDesktopLink.url}
                        </div>
                        {webDesktopLinks.length > 1 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {webDesktopLinks.map((link, linkIndex) => (
                              <Button
                                key={`${link.url}-${linkIndex}`}
                                type="button"
                                size="sm"
                                variant={linkIndex === 0 ? 'default' : 'outline'}
                                className="h-8 rounded-full px-3 text-[0.68rem]"
                                onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                              >
                                {link.label || `Port ${link.internalPort || link.publicPort || linkIndex + 1}`}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {connection.password ? (
                      <div className="rounded-[1rem] border border-violet-400/25 bg-violet-500/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-black text-violet-700 dark:text-violet-200">
                            <KeyRound className="h-4 w-4" />
                            Thông tin đăng nhập do nguồn GPU cung cấp
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setRevealedPasswordId(revealedPasswordId === id ? null : id)}
                            >
                              {revealedPasswordId === id ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                              {revealedPasswordId === id ? 'Ẩn' : 'Hiện'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void copyText(connection.password, 'Đã sao chép mật khẩu')}
                            >
                              <Clipboard className="mr-2 h-4 w-4" />
                              Copy mật khẩu
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <MiniInfo icon={<Terminal />} label="User" value={connection.username || 'root'} />
                          <MiniInfo
                            icon={<KeyRound />}
                            label="Mật khẩu"
                            value={revealedPasswordId === id ? connection.password : '••••••••••••'}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <MiniInfo icon={<RefreshCw />} label="Trạng thái nguồn" value={instance.sourceStatus?.actualStatus || 'Đang tạo'} />
                      <MiniInfo icon={<RefreshCw />} label="Trạng thái máy" value={instance.sourceStatus?.curState || 'N/A'} />
                      <MiniInfo icon={<Network />} label="Public IP" value={connection.publicIp || connection.host || 'Đang cập nhật'} />
                      <MiniInfo icon={<Terminal />} label="SSH Port" value={connection.port ? String(connection.port) : 'Đang cập nhật'} />
                      <MiniInfo icon={<Monitor />} label="RDP Port" value={connection.rdpPort ? String(connection.rdpPort) : 'N/A'} />
                      <MiniInfo
                        icon={<Monitor />}
                        label="Remote Web"
                        value={primaryWebDesktopLink
                          ? `${primaryWebDesktopLink.publicPort || connection.webDesktopPort}${primaryWebDesktopLink.internalPort ? ` (${primaryWebDesktopLink.internalPort})` : ''}`
                          : 'N/A'}
                      />
                      <MiniInfo icon={<Server />} label="Port Range" value={connection.portRange || 'N/A'} />
                      <MiniInfo icon={<MapPin />} label="Khu vực" value={instance.attributes?.region || instance.ipAddress || 'N/A'} />
                      <MiniInfo icon={<ShieldCheck />} label="IP Type" value={connection.ipAddressType || 'N/A'} />
                      <MiniInfo icon={<Network />} label="Local IP" value={connection.localIps?.length ? connection.localIps.join(', ') : 'N/A'} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <MiniInfo
                        icon={<Cpu />}
                        label="GPU"
                        value={`${specs.gpuCount || 1}x ${specs.gpuName || 'GPU'}${specs.gpuRamGb ? ` · ${specs.gpuRamGb}GB` : ''}`}
                      />
                      <MiniInfo icon={<Cpu />} label="CPU" value={[specs.cpuName, formatCpuCores(specs.cpuCores)].filter(Boolean).join(' · ')} />
                      <MiniInfo icon={<Database />} label="RAM" value={specs.ramGb ? `${specs.ramGb} GB` : 'N/A'} />
                      <MiniInfo icon={<HardDrive />} label="Disk" value={specs.diskGb ? `${Math.round(specs.diskGb)} GB` : 'N/A'} />
                      <MiniInfo icon={<Server />} label="Image" value={specs.image || 'N/A'} />
                      <MiniInfo
                        icon={<Network />}
                        label="Network"
                        value={`${formatMbps(specs.networkDownMbps)} down / ${formatMbps(specs.networkUpMbps)} up`}
                      />
                      <MiniInfo icon={<Cpu />} label="Giá thuê" value={formatVnd(billing?.saleHourlyVnd)} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniInfo icon={<Server />} label="Machine ID" value={specs.machineId || 'N/A'} />
                      <MiniInfo icon={<Server />} label="Host ID" value={specs.hostId || 'N/A'} />
                      <MiniInfo icon={<Database />} label="Tổng chi phí" value={formatMoneyVnd(billing?.totalChargedVnd)} />
                      <MiniInfo icon={<RefreshCw />} label="Gia hạn lúc (VN)" value={formatDateTime(billing?.nextChargeAtMs ?? billing?.nextChargeAt)} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={instanceAction === `start:${id}`}
                        onClick={() => id && void runInstanceAction('start', id)}
                        disabled={!id}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Chạy
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={instanceAction === `stop:${id}`}
                        onClick={() => id && void runInstanceAction('stop', id)}
                        disabled={!id}
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Dừng
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        loading={instanceAction === `delete:${id}`}
                        onClick={() => id && void runInstanceAction('delete', id)}
                        disabled={!id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xóa
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Chưa có VPS GPU"
            description="Chọn cấu hình bên trên rồi tạo instance mới. Khi hệ thống trả instance, danh sách sẽ hiện tại đây."
            icon={<Cpu className="h-5 w-5" />}
          />
        )}
      </SectionPanel>

      <div id="vps-gpu-ssh-guide" className="scroll-mt-28">
      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Hướng dẫn kết nối"
          title="Lấy SSH public key và đăng nhập VPS"
          description="VPS chỉ cho đăng nhập bằng public key. Khi tạo VPS, dán public key của thiết bị bạn dùng để hệ thống gắn key vào đúng VPS."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <GuideCard
            title="macOS / Linux"
            steps={[
              'Mở Terminal.',
              'Chạy ssh-keygen -t ed25519 -C "email-cua-ban" nếu máy chưa có key.',
              'Chạy cat ~/.ssh/id_ed25519.pub rồi copy toàn bộ dòng bắt đầu bằng ssh-ed25519.',
              'Dán dòng đó vào ô SSH public key trước khi bấm tạo VPS.',
            ]}
            commands={[
              'ssh-keygen -t ed25519 -C "email-cua-ban"',
              'cat ~/.ssh/id_ed25519.pub',
              'ssh -p PORT root@HOST',
              'ssh -p PORT root@HOST -L 8080:localhost:8080',
            ]}
          />

          <GuideCard
            title="Windows"
            steps={[
              'Mở PowerShell hoặc Windows Terminal.',
              'Chạy ssh-keygen -t ed25519 -C "email-cua-ban" nếu chưa có key.',
              'Chạy type $env:USERPROFILE\\.ssh\\id_ed25519.pub rồi copy public key.',
              'Dùng lệnh SSH mà website hiển thị sau khi VPS sẵn sàng.',
            ]}
            commands={[
              'ssh-keygen -t ed25519 -C "email-cua-ban"',
              'type $env:USERPROFILE\\.ssh\\id_ed25519.pub',
              'ssh -p PORT root@HOST',
            ]}
          />

          <GuideCard
            title="Android"
            steps={[
              'Cài Termux hoặc JuiceSSH.',
              'Trong Termux chạy ssh-keygen -t ed25519 rồi cat ~/.ssh/id_ed25519.pub.',
              'Nếu dùng JuiceSSH, tạo identity/key rồi copy public key trong phần Identity.',
              'Dán public key vào website, tạo VPS xong dùng host và port website cung cấp để SSH.',
            ]}
            commands={[
              'ssh-keygen -t ed25519',
              'cat ~/.ssh/id_ed25519.pub',
              'ssh -p PORT root@HOST',
            ]}
          />

          <GuideCard
            title="iPhone / iPad"
            steps={[
              'Cài app Termius, Blink Shell hoặc Shelly.',
              'Tạo SSH key trong app rồi copy public key, không copy private key.',
              'Dán public key vào website trước khi tạo VPS.',
              'Sau khi VPS sẵn sàng, tạo host mới trong app với username root, host và port website hiển thị.',
            ]}
            commands={[
              'Host: HOST',
              'Port: PORT',
              'Username: root',
              'Auth: Key / Identity vừa tạo',
            ]}
          />
        </div>

        <div className="rounded-[1rem] border border-amber-400/25 bg-amber-500/10 p-4 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
          Nếu terminal báo <span className="font-mono font-black">Permission denied (publickey)</span>, nghĩa là public key của thiết bị hiện tại chưa được gắn vào VPS. Xóa VPS lỗi, tạo lại và dán đúng nội dung file <span className="font-mono font-black">.pub</span> của thiết bị bạn đang dùng.
        </div>
      </SectionPanel>
      </div>
    </div>
  );
}

function ChoiceGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ value: T; title: string; description: string; recommended?: boolean }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-black tracking-[-0.02em] text-slate-950 dark:text-white sm:text-xl">{title}</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-[1.2rem] border p-4 text-left transition-all sm:p-5',
                active
                  ? 'border-brand-blue/35 bg-blue-50 text-slate-950 shadow-[0_0_0_3px_rgba(37,99,235,0.12)] dark:border-brand-blue/45 dark:bg-brand-blue/10 dark:text-white'
                  : 'border-slate-200/80 bg-white/70 text-slate-700 hover:border-brand-blue/20 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]'
              )}
            >
              <div className="text-base font-black leading-tight sm:text-lg">
                {option.title}
                {option.recommended ? <span className="ml-2 text-amber-500">★</span> : null}
              </div>
              <div className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{option.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function GuideCard({ title, steps, commands }: { title: string; steps: string[]; commands: string[] }) {
  return (
    <div className="rounded-[1.2rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <h3 className="text-base font-black text-slate-950 dark:text-white">{title}</h3>
      <ol className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="mt-4 space-y-2">
        {commands.map((command) => (
          <div
            key={command}
            className="overflow-x-auto rounded-[0.8rem] border border-slate-200/70 bg-slate-950 px-3 py-2 font-mono text-xs font-bold text-cyan-100 dark:border-white/10"
          >
            {command}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
        <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        <span className="text-[9px] font-black uppercase tracking-[0.22em]">{label}</span>
      </div>
      <div className="mt-2 break-words text-sm font-black leading-5 text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}
