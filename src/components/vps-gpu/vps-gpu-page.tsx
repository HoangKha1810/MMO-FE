'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Cpu,
  Database,
  DollarSign,
  Globe2,
  KeyRound,
  Loader2,
  MapPin,
  Network,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Square,
  TerminalSquare,
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

type DeploymentMethod = 'location' | 'hostnode';
type NetworkMode = 'port-forwarding' | 'dedicated-ip';
type VastRuntime = 'ssh' | 'jupyter' | 'args';
type OfferType = 'ondemand' | 'bid';

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

interface VastSecret {
  id: string;
  name?: string;
  type?: string;
}

interface VastInstance {
  id?: string;
  name?: string;
  status?: string;
  type?: string;
  ipAddress?: string;
  rateHourly?: number;
  attributes?: {
    name?: string;
    status?: string;
    region?: string;
  };
}

interface VastOverviewData {
  locations?: unknown;
  hostnodes?: unknown;
  secrets?: unknown;
  instances?: unknown;
  defaultSshKeySecretId?: unknown;
}

const deploymentOptions: Array<{
  value: DeploymentMethod;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  { value: 'hostnode', title: 'Vast Offer', description: 'Tạo đúng offer GPU đã chọn', recommended: true },
  { value: 'location', title: 'Auto Offer', description: 'Chọn offer rẻ trong khu vực' },
];

const networkOptions: Array<{
  value: NetworkMode;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  { value: 'port-forwarding', title: 'SSH / Port', description: 'Mở SSH và port app' },
  { value: 'dedicated-ip', title: 'Public IP', description: 'Ưu tiên kết nối trực tiếp', recommended: true },
];

const runtimeOptions: Array<{
  value: VastRuntime;
  title: string;
  description: string;
}> = [
  { value: 'ssh', title: 'SSH Docker', description: 'Runtime chuẩn cho VPS GPU' },
  { value: 'jupyter', title: 'Jupyter Lab', description: 'Mở notebook trên container' },
  { value: 'args', title: 'Custom Args', description: 'Chạy lệnh/args riêng' },
];

const ramSteps = [8, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 512];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function extractLocations(payload: unknown): VastLocation[] {
  return toArray<VastLocation>(asRecord(asRecord(payload).data).locations);
}

function extractHostnodes(payload: unknown): VastHostnode[] {
  return toArray<VastHostnode>(asRecord(asRecord(payload).data).hostnodes);
}

function extractSecrets(payload: unknown): VastSecret[] {
  return toArray<VastSecret>(asRecord(asRecord(payload).data).secrets);
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

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePorts(value: string) {
  return value
    .split(/[,\n\s]+/)
    .map((item) => Math.trunc(Number(item.trim())))
    .filter((item) => Number.isFinite(item) && item > 0 && item <= 65535);
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

function statusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('running')) return 'success';
  if (normalized.includes('stopping') || normalized.includes('starting')) return 'warning';
  if (normalized.includes('stop')) return 'muted';
  return 'info';
}

function buildLoadErrorMessage(message: string) {
  if (message.includes('Thiếu VAST_API_KEY')) {
    return `${message}. Cần cấu hình env VAST_API_KEY trên server rồi restart Next.js.`;
  }

  if (message.includes('HTTP 401') || message.includes('HTTP 403')) {
    return `${message}. API key Vast.ai có thể sai, hết hạn hoặc thiếu quyền.`;
  }

  return message;
}

export function VpsGpuPage({ initialUser: _initialUser }: VpsGpuPageProps) {
  const { confirm } = useConfirmDialog();
  const [locations, setLocations] = useState<VastLocation[]>([]);
  const [hostnodes, setHostnodes] = useState<VastHostnode[]>([]);
  const [secrets, setSecrets] = useState<VastSecret[]>([]);
  const [instances, setInstances] = useState<VastInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [instanceAction, setInstanceAction] = useState<string | null>(null);

  const [offerType, setOfferType] = useState<OfferType>('ondemand');
  const [offerGpuFilter, setOfferGpuFilter] = useState('');
  const [minGpuRamGb, setMinGpuRamGb] = useState('16');
  const [minReliability, setMinReliability] = useState('0.98');
  const [searchingOffers, setSearchingOffers] = useState(false);

  const [deploymentMethod, setDeploymentMethod] = useState<DeploymentMethod>('hostnode');
  const [networkMode, setNetworkMode] = useState<NetworkMode>('port-forwarding');
  const [runtime, setRuntime] = useState<VastRuntime>('ssh');
  const [instanceName, setInstanceName] = useState('trungtammmo-gpu-ai');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedHostnodeId, setSelectedHostnodeId] = useState('');
  const [gpuV0Name, setGpuV0Name] = useState('RTX 4090');
  const [gpuCount, setGpuCount] = useState('1');
  const [vcpuCount, setVcpuCount] = useState('4');
  const [ramGb, setRamGb] = useState('16');
  const [storageGb, setStorageGb] = useState('200');
  const [dockerImage, setDockerImage] = useState('vastai/base-image:@vastai-automatic-tag');
  const [targetState, setTargetState] = useState('running');
  const [envFlags, setEnvFlags] = useState('-p 22:22 -p 8080:8080');
  const [onStartCommand, setOnStartCommand] = useState('nvidia-smi');
  const [cancelUnavailable, setCancelUnavailable] = useState(true);
  const [sshKey, setSshKey] = useState('');
  const [portList, setPortList] = useState('22, 8080');
  const [argsString, setArgsString] = useState('');

  async function loadOverview() {
    setLoading(true);
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
      const nextSecrets = extractSecrets(data.secrets);
      const defaultSshKeySecretId = String(data.defaultSshKeySecretId || '').trim();
      const sshKeySecretId = nextSecrets.find((secret) => String(secret.type || '').toUpperCase() === 'SSHKEY')?.id;
      setSecrets(nextSecrets);
      setSshKey((current) => current || sshKeySecretId || defaultSshKeySecretId);
      setDockerImage((current) => current || String(asRecord(payload.data).defaultImage || 'vastai/base-image:@vastai-automatic-tag'));
      setLoadError(payload.message ? String(payload.message) : null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu VPS GPU';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

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
            minReliability,
            type: offerType,
            limit: 80,
          },
        }),
      });
      const payload = await readJsonResponse(response, 'Không thể tìm offer Vast.ai');
      if (!payload.success) {
        throw new Error(payload.message || 'Không thể tìm offer Vast.ai');
      }
      const nextHostnodes = toArray<VastHostnode>(asRecord(payload.data).hostnodes);
      setHostnodes(nextHostnodes);
      const nextHostnodeId = nextHostnodes[0]?.id || '';
      if (nextHostnodeId) {
        setSelectedHostnodeId(nextHostnodeId);
        const nextGpu = nextHostnodes[0]?.available_resources?.gpus?.[0]?.v0Name;
        if (nextGpu) {
          setGpuV0Name(nextGpu);
        }
      }
      toast.success(`Đã tải ${nextHostnodes.length} offer Vast.ai`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tìm offer Vast.ai');
    } finally {
      setSearchingOffers(false);
    }
  }

  const selectedHostnode = useMemo(
    () => hostnodes.find((item) => item.id === selectedHostnodeId) || hostnodes[0] || null,
    [hostnodes, selectedHostnodeId]
  );

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

  const sshKeySecrets = useMemo(
    () => secrets.filter((secret) => String(secret.type || '').toUpperCase() === 'SSHKEY'),
    [secrets]
  );

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

  useEffect(() => {
    if (!sshKey && sshKeySecrets[0]?.id) {
      setSshKey(sshKeySecrets[0].id);
    }
  }, [sshKey, sshKeySecrets]);

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

    const attributes: Record<string, unknown> = {
      name,
      type: 'virtualmachine',
      image: dockerImage.trim() || 'vastai/base-image:@vastai-automatic-tag',
      runtype: runtime,
      target_state: targetState,
      cancel_unavail: cancelUnavailable,
      onstart: onStartCommand.trim() || 'nvidia-smi',
      python_utf8: true,
      lang_utf8: true,
      use_jupyter_lab: runtime === 'jupyter',
      env: envFlags.trim(),
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

    if (deploymentMethod === 'location') {
      const locationId = selectedLocation?.id || selectedLocationId;
      if (!locationId) {
        throw new Error('Thiếu location_id');
      }
      attributes.location_id = locationId;
      const locationHostnode = hostnodes.find(
        (hostnode) =>
          (hostnode.location_id === locationId || hostnode.location?.country === locationId) &&
          hostnode.available_resources?.gpus?.some((gpu) => gpu.v0Name === gpuName)
      ) || hostnodes.find((hostnode) => hostnode.location_id === locationId || hostnode.location?.country === locationId);
      const offerId = locationHostnode?.id || selectedHostnode?.id || selectedHostnodeId;
      if (!offerId) {
        throw new Error('Không tìm thấy Vast offer trong khu vực đã chọn');
      }
      attributes.offer_id = offerId;
    } else {
      const hostnodeId = selectedHostnode?.id || selectedHostnodeId;
      if (!hostnodeId) {
        throw new Error('Thiếu Vast offer_id');
      }
      attributes.hostnode_id = hostnodeId;
      attributes.offer_id = hostnodeId;
    }

    if (networkMode === 'dedicated-ip') {
      attributes.useDedicatedIp = true;
    } else {
      const ports = parsePorts(portList);
      if (!ports.length) {
        throw new Error('Thiếu port forwarding');
      }
      attributes.port_forwards = ports.map((port) => ({
        internal_port: port,
        external_port: 0,
      }));
    }

    if (runtime === 'ssh' && !sshKey.trim()) {
      throw new Error('Cần thêm SSH key trong Vast.ai trước khi tạo instance. Vào Vast.ai > Manage Keys > SSH Keys để thêm public key.');
    }

    if (runtime === 'ssh') {
      attributes.ssh_key = sshKey.trim();
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

  const generatedPayload = useMemo(() => {
    try {
      return buildPayload();
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Payload chưa hợp lệ',
      };
    }
  }, [
    argsString,
    cancelUnavailable,
    deploymentMethod,
    dockerImage,
    envFlags,
    gpuCount,
    gpuV0Name,
    instanceName,
    networkMode,
    onStartCommand,
    portList,
    ramGb,
    runtime,
    selectedHostnode,
    selectedHostnodeId,
    selectedLocation,
    selectedLocationId,
    sshKey,
    storageGb,
    targetState,
    vcpuCount,
  ]);

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

  async function handleCreateInstance() {
    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payload chưa hợp lệ');
      return;
    }

    const confirmed = await confirm({
      title: 'Tạo VPS GPU trên Vast.ai',
      description: `Instance ${instanceName.trim()} sẽ được tạo trực tiếp trên tài khoản Vast.ai cấu hình trong server. Kiểm tra kỹ offer, Docker image và số dư trước khi tiếp tục.`,
      confirmText: 'Tạo instance',
      cancelText: 'Kiểm tra lại',
      tone: 'brand',
    });

    if (!confirmed) {
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
        throw new Error(result.message || 'Không thể tạo VPS GPU');
      }
      toast.success('Đã gửi lệnh tạo VPS GPU');
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo VPS GPU');
    } finally {
      setSubmitting(false);
    }
  }

  async function runInstanceAction(action: 'start' | 'stop' | 'delete', instanceId: string) {
    if (action === 'delete') {
      const confirmed = await confirm({
        title: 'Xóa instance VPS GPU',
        description: `Instance ${instanceId} sẽ bị xóa khỏi Vast.ai. Thao tác này không thể hoàn tác.`,
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
      toast.success('Đã gửi lệnh tới Vast.ai');
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Thao tác instance thất bại');
    } finally {
      setInstanceAction(null);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Vast.ai GPU Cloud"
        title="Thuê VPS GPU mạnh cho AI, game và render"
        description="Tạo VPS GPU Vast.ai trực tiếp từ TRUNGTAMMMO. Chọn offer GPU, Docker image, network và xem payload API trước khi gửi lệnh."
        actions={
          <>
            <Button type="button" onClick={() => void loadOverview()} disabled={loading} variant="outline">
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh API
            </Button>
            <Button type="button" onClick={() => void handleCreateInstance()} loading={submitting} loadingText="Đang tạo...">
              <Cpu className="mr-2 h-4 w-4" />
              Tạo VPS GPU
            </Button>
          </>
        }
        stats={[
          { label: 'Locations', value: String(locations.length), hint: 'Khu vực có GPU', tone: 'blue' },
          { label: 'Offers', value: String(hostnodes.length), hint: 'Offer Vast.ai đang rentable', tone: 'emerald' },
          { label: 'Instances', value: String(instances.length), hint: 'VM đang quản lý', tone: 'violet' },
          { label: 'Est. Hourly', value: formatUsd(estimatedHourly), hint: 'Ước tính theo GPU/resource', tone: 'amber' },
        ]}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniInfo icon={<Globe2 />} label="API" value="/api/v0/bundles" />
          <MiniInfo icon={<TerminalSquare />} label="Runtime" value={runtime.toUpperCase()} />
          <MiniInfo icon={<DollarSign />} label="Selected" value={formatUsd(getHostnodePrice(selectedHostnode))} />
        </div>
      </PageHero>

      {loadError ? (
        <SectionPanel className="border-amber-500/25 bg-amber-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">Vast.ai chưa sẵn sàng</div>
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
          eyebrow="Offer Explorer"
          title="Chọn offer Vast.ai thật trước khi tạo VPS"
          description="Dữ liệu lấy từ POST /api/v0/bundles. Chọn offer ở dưới để tự điền ask_id, GPU, giá giờ và cấu hình launch."
          actions={
            <Button type="button" onClick={() => void searchOffers()} loading={searchingOffers} loadingText="Đang lọc...">
              <RefreshCw className="mr-2 h-4 w-4" />
              Lọc offer
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
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
          <Field label="GPU name optional">
            <Input value={offerGpuFilter} onChange={(event) => setOfferGpuFilter(event.target.value)} placeholder="RTX 4090 / A100..." />
          </Field>
          <Field label="Min GPU RAM">
            <Input type="number" min={1} value={minGpuRamGb} onChange={(event) => setMinGpuRamGb(event.target.value)} />
          </Field>
          <Field label="Reliability">
            <Input type="number" min={0} max={1} step={0.01} value={minReliability} onChange={(event) => setMinReliability(event.target.value)} />
          </Field>
        </div>

        {loading ? (
          <EmptyState title="Đang tải offer Vast.ai" description="Hệ thống đang gọi bundles, user, SSH keys và instances." icon={<Loader2 className="h-5 w-5 animate-spin" />} />
        ) : hostnodes.length ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {hostnodes.slice(0, 9).map((hostnode) => {
              const active = String(hostnode.id) === String(selectedHostnode?.id || selectedHostnodeId);
              const gpu = getHostnodeGpu(hostnode);
              const offer = asRecord(hostnode.vast);
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
                      <div className="text-[10px] font-black uppercase tracking-[0.26em] text-brand-blue">Ask #{hostnode.id}</div>
                      <div className="mt-2 truncate text-base font-black text-slate-950 dark:text-white">{getHostnodeGpuLabel(hostnode)}</div>
                    </div>
                    <Badge variant={active ? 'default' : 'success'} className="shrink-0 rounded-full">
                      {formatUsd(getHostnodePrice(hostnode))}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                    <MiniInfo icon={<Cpu />} label="GPU RAM" value={formatGb((Number(offer.gpu_ram || 0) || 0) / 1024 || gpu?.resources?.max_ram_gb)} />
                    <MiniInfo icon={<ShieldCheck />} label="Reliability" value={formatPercent(offer.reliability || hostnode.uptime_percentage)} />
                    <MiniInfo icon={<Database />} label="RAM" value={formatGb(hostnode.available_resources?.ram_gb)} />
                    <MiniInfo icon={<Network />} label="Network" value={formatNetworkSpeed(hostnode.location?.network_speed_gbps)} />
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
          <EmptyState title="Chưa có offer phù hợp" description="Thử giảm điều kiện GPU RAM/reliability hoặc bỏ filter GPU name." icon={<Cpu className="h-5 w-5" />} />
        )}
      </SectionPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Launch Config"
            title="Cấu hình instance theo Vast API"
            description="Các trường này map trực tiếp sang payload PUT /api/v0/asks/{offer_id}: image, disk, runtype, target_state, env và onstart."
          />

          <div className="space-y-7">
            <ChoiceGroup
              title="Deployment Method"
              options={deploymentOptions}
              value={deploymentMethod}
              onChange={setDeploymentMethod}
            />
            <ChoiceGroup
              title="Network Configuration"
              options={networkOptions}
              value={networkMode}
              onChange={setNetworkMode}
            />
            <ChoiceGroup
              title="Runtime"
              options={runtimeOptions}
              value={runtime}
              onChange={setRuntime}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên instance">
              <Input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} />
            </Field>

            <Field label={deploymentMethod === 'location' ? 'Khu vực' : 'Vast offer ID'}>
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
                      #{hostnode.id} · {hostnode.engine || 'Vast offer'} · {formatLocation(hostnode.location)}
                    </option>
                  ))}
                  {!hostnodes.length ? <option value="">Chưa có hostnode</option> : null}
                </select>
              )}
            </Field>

            <Field label="GPU model">
              <select
                value={selectedGpu?.v0Name || gpuV0Name}
                onChange={(event) => setGpuV0Name(event.target.value)}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
              >
                {gpuOptions.map((gpu) => (
                  <option key={gpu.v0Name} value={gpu.v0Name}>
                    {gpu.displayName || gpu.v0Name} · {formatUsd(gpu.price_per_hr)}
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

            <Field label="Storage GB">
              <Input min={100} step={50} type="number" value={storageGb} onChange={(event) => setStorageGb(event.target.value)} />
            </Field>

            <Field label="Docker image">
              <Input value={dockerImage} onChange={(event) => setDockerImage(event.target.value)} placeholder="vastai/base-image:@vastai-automatic-tag" />
            </Field>

            <Field label="Target state">
              <select
                value={targetState}
                onChange={(event) => setTargetState(event.target.value)}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
              >
                <option value="running">Running sau khi tạo</option>
                <option value="stopped">Tạo nhưng để stopped</option>
              </select>
            </Field>

            <Field label="Onstart command">
              <Input value={onStartCommand} onChange={(event) => setOnStartCommand(event.target.value)} placeholder="nvidia-smi" />
            </Field>

            {networkMode === 'port-forwarding' ? (
              <Field label="Port forwarding">
                <Input value={portList} onChange={(event) => setPortList(event.target.value)} placeholder="22, 8080" />
              </Field>
            ) : (
              <MetricCard
                label="Dedicated IP"
                value="Enabled"
                hint="Vast.ai sẽ trả thông tin SSH/public IP khi instance sẵn sàng"
                tone="blue"
                icon={<ShieldCheck className="h-4 w-4" />}
                className="p-4"
              />
            )}

            {runtime === 'ssh' ? (
              <Field label="SSH key ID">
                <select
                  value={sshKey}
                  onChange={(event) => setSshKey(event.target.value)}
                  className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
                >
                  {sshKeySecrets.map((secret) => (
                    <option key={secret.id} value={secret.id}>
                      {secret.name || secret.id}
                    </option>
                  ))}
                  {!sshKeySecrets.length ? <option value="">Chưa có SSH key trên Vast.ai</option> : null}
                </select>
                <Input
                  className="mt-2"
                  value={sshKey}
                  onChange={(event) => setSshKey(event.target.value)}
                  placeholder="ID SSH key trên Vast.ai, có thể để trống nếu account đã có key mặc định"
                />
              </Field>
            ) : (
              <Field label="Args string optional">
                <Input
                  value={argsString}
                  onChange={(event) => setArgsString(event.target.value)}
                  placeholder="Command args nếu dùng runtime custom"
                />
              </Field>
            )}
          </div>

          <Field label="Docker env flags">
            <textarea
              value={envFlags}
              onChange={(event) => setEnvFlags(event.target.value)}
              rows={5}
              placeholder="-p 22:22 -p 8080:8080 -e JUPYTER_PASSWORD=..."
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
            Hủy lệnh nếu offer đã hết rentable khi gửi request
          </label>
        </SectionPanel>

        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Generated API Request"
            title="PUT /api/v0/asks/{offer_id}"
            description="Payload này được gửi qua server nội bộ, server sẽ tự gắn Bearer token Vast.ai."
          />
          <pre className="max-h-[620px] overflow-auto rounded-[1.35rem] border border-slate-200/80 bg-slate-950 p-4 text-xs font-semibold leading-6 text-cyan-100 shadow-inner dark:border-white/10">
            {JSON.stringify(generatedPayload, null, 2)}
          </pre>
        </SectionPanel>
      </div>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Instance Management"
          title="VPS GPU đang chạy"
          description="Theo dõi và gửi lệnh start, stop hoặc delete tới Vast.ai."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          }
        />

        {loading ? (
          <EmptyState title="Đang tải Vast.ai" description="Hệ thống đang lấy offers, SSH keys và instances." icon={<Loader2 className="h-5 w-5 animate-spin" />} />
        ) : instances.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {instances.map((instance) => {
              const id = instance.id || '';
              const status = getInstanceStatus(instance);
              return (
                <Card key={id || getInstanceName(instance)} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{getInstanceName(instance)}</CardTitle>
                        <CardDescription className="mt-2 font-mono text-xs">{id || 'No ID'}</CardDescription>
                      </div>
                      <Badge variant={statusVariant(status)} className="shrink-0 rounded-full">
                        {status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniInfo icon={<Server />} label="Type" value={instance.type || 'VM'} />
                      <MiniInfo icon={<MapPin />} label="Region" value={instance.attributes?.region || instance.ipAddress || 'N/A'} />
                      <MiniInfo icon={<KeyRound />} label="Hourly" value={formatUsd(instance.rateHourly)} />
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
                        Start
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
                        Stop
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
                        Delete
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
            description="Chọn cấu hình bên trên rồi tạo instance mới. Khi Vast.ai trả instance, danh sách sẽ hiện tại đây."
            icon={<Cpu className="h-5 w-5" />}
          />
        )}
      </SectionPanel>
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
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-black text-slate-600 dark:border-white/20 dark:text-white/70">
          i
        </span>
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

function MiniInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
        <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        <span className="text-[9px] font-black uppercase tracking-[0.22em]">{label}</span>
      </div>
      <div className="mt-2 truncate text-sm font-black text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}
