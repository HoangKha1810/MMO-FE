'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Cpu,
  KeyRound,
  Loader2,
  MapPin,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Square,
  Trash2,
} from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/hooks/use-session-user';

type DeploymentMethod = 'location' | 'hostnode';
type NetworkMode = 'port-forwarding' | 'dedicated-ip';
type OperatingSystem = 'ubuntu2404' | 'windows10';

interface VpsGpuPageProps {
  initialUser?: SessionUser;
}

interface TensorDockGpu {
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
  };
  network_features?: {
    dedicated_ip_available?: boolean;
    port_forwarding_available?: boolean;
    network_storage_available?: boolean;
  };
}

interface TensorDockLocation {
  id: string;
  city?: string;
  stateprovince?: string;
  country?: string;
  tier?: number;
  gpus?: TensorDockGpu[];
}

interface TensorDockHostnode {
  id: string;
  location_id?: string;
  engine?: string;
  uptime_percentage?: number;
  available_resources?: {
    gpus?: TensorDockGpu[];
    vcpu_count?: number;
    ram_gb?: number;
    storage_gb?: number;
    has_public_ip_available?: boolean;
  };
  pricing?: {
    per_vcpu_hr?: number;
    per_gb_ram_hr?: number;
    per_gb_storage_hr?: number;
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
}

interface TensorDockSecret {
  id: string;
  name?: string;
  type?: string;
}

interface TensorDockInstance {
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

const deploymentOptions: Array<{
  value: DeploymentMethod;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  { value: 'hostnode', title: 'Hostnode Based', description: 'Deploy to specific hostnode' },
  { value: 'location', title: 'Location Based', description: 'Auto-select best hostnode', recommended: true },
];

const networkOptions: Array<{
  value: NetworkMode;
  title: string;
  description: string;
  recommended?: boolean;
}> = [
  { value: 'port-forwarding', title: 'Port Forwarding', description: 'Map specific ports' },
  { value: 'dedicated-ip', title: 'Dedicated IP', description: 'Full public IP address', recommended: true },
];

const osOptions: Array<{
  value: OperatingSystem;
  title: string;
  description: string;
}> = [
  { value: 'ubuntu2404', title: 'Ubuntu 24.04', description: 'Linux with SSH access' },
  { value: 'windows10', title: 'Windows 10', description: 'Windows with RDP access' },
];

const ramSteps = [8, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 512];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function extractLocations(payload: unknown): TensorDockLocation[] {
  return toArray<TensorDockLocation>(asRecord(asRecord(payload).data).locations);
}

function extractHostnodes(payload: unknown): TensorDockHostnode[] {
  return toArray<TensorDockHostnode>(asRecord(asRecord(payload).data).hostnodes);
}

function extractSecrets(payload: unknown): TensorDockSecret[] {
  return toArray<TensorDockSecret>(asRecord(asRecord(payload).data).secrets);
}

function extractInstances(payload: unknown): TensorDockInstance[] {
  const data = asRecord(asRecord(payload).data);
  const direct = toArray<TensorDockInstance>(data.instances);
  if (direct.length) {
    return direct;
  }

  return toArray<TensorDockInstance>(asRecord(data.attributes).instances);
}

function formatUsd(value: number | undefined) {
  if (!Number.isFinite(value || 0) || !value) {
    return '$0/h';
  }
  return `$${value.toFixed(value >= 1 ? 2 : 3)}/h`;
}

function formatLocation(location: TensorDockLocation | TensorDockHostnode['location']) {
  if (!location) {
    return 'Unknown location';
  }

  return [location.city, location.stateprovince, location.country].filter(Boolean).join(', ') || 'Unknown location';
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

function uniqueGpus(gpus: TensorDockGpu[]) {
  const seen = new Set<string>();
  return gpus.filter((gpu) => {
    if (!gpu.v0Name || seen.has(gpu.v0Name)) {
      return false;
    }
    seen.add(gpu.v0Name);
    return true;
  });
}

function getInstanceName(instance: TensorDockInstance) {
  return instance.attributes?.name || instance.name || instance.id || 'Unknown instance';
}

function getInstanceStatus(instance: TensorDockInstance) {
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
  if (message.includes('Thiếu TENSORDOCK_API_TOKEN')) {
    return `${message}. Cần cấu hình env TENSORDOCK_API_TOKEN trên server rồi restart Next.js.`;
  }

  if (message.includes('HTTP 401') || message.includes('HTTP 403')) {
    return `${message}. Token TensorDock có thể sai, hết hạn hoặc thiếu quyền.`;
  }

  return message;
}

export function VpsGpuPage({ initialUser }: VpsGpuPageProps) {
  const { confirm } = useConfirmDialog();
  const [locations, setLocations] = useState<TensorDockLocation[]>([]);
  const [hostnodes, setHostnodes] = useState<TensorDockHostnode[]>([]);
  const [secrets, setSecrets] = useState<TensorDockSecret[]>([]);
  const [instances, setInstances] = useState<TensorDockInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [instanceAction, setInstanceAction] = useState<string | null>(null);

  const [deploymentMethod, setDeploymentMethod] = useState<DeploymentMethod>('location');
  const [networkMode, setNetworkMode] = useState<NetworkMode>('port-forwarding');
  const [operatingSystem, setOperatingSystem] = useState<OperatingSystem>('ubuntu2404');
  const [instanceName, setInstanceName] = useState('trungtammmo-gpu-ai');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedHostnodeId, setSelectedHostnodeId] = useState('');
  const [gpuV0Name, setGpuV0Name] = useState('geforcertx4090-pcie-24gb');
  const [gpuCount, setGpuCount] = useState('1');
  const [vcpuCount, setVcpuCount] = useState('4');
  const [ramGb, setRamGb] = useState('16');
  const [storageGb, setStorageGb] = useState('200');
  const [sshKey, setSshKey] = useState('');
  const [windowsPassword, setWindowsPassword] = useState('MySecureP@ssw0rd123!');
  const [portList, setPortList] = useState('22, 8080');
  const [cloudInitJson, setCloudInitJson] = useState('');

  async function loadOverview() {
    setLoading(true);
    try {
      const response = await fetch('/api/vps-gpu?resource=overview', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dữ liệu VPS GPU');
      }

      const data = asRecord(payload.data);
      setLocations(extractLocations(data.locations));
      setHostnodes(extractHostnodes(data.hostnodes));
      setInstances(extractInstances(data.instances));
      setSecrets(extractSecrets(data.secrets));
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

  const selectedLocation = useMemo(
    () => locations.find((item) => item.id === selectedLocationId) || locations[0] || null,
    [locations, selectedLocationId]
  );

  const selectedHostnode = useMemo(
    () => hostnodes.find((item) => item.id === selectedHostnodeId) || hostnodes[0] || null,
    [hostnodes, selectedHostnodeId]
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
      image: operatingSystem,
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
    } else {
      const hostnodeId = selectedHostnode?.id || selectedHostnodeId;
      if (!hostnodeId) {
        throw new Error('Thiếu hostnode_id');
      }
      attributes.hostnode_id = hostnodeId;
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

    if (operatingSystem === 'ubuntu2404') {
      if (!sshKey.trim()) {
        throw new Error('Ubuntu cần SSH key secret ID');
      }
      attributes.ssh_key = sshKey.trim();
    } else {
      if (!windowsPassword.trim()) {
        throw new Error('Windows cần password');
      }
      attributes.password = windowsPassword.trim();
    }

    if (cloudInitJson.trim()) {
      const parsed = JSON.parse(cloudInitJson) as Record<string, unknown>;
      attributes.cloud_init = parsed.cloud_init || parsed;
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
    cloudInitJson,
    deploymentMethod,
    gpuCount,
    gpuV0Name,
    instanceName,
    networkMode,
    operatingSystem,
    portList,
    ramGb,
    selectedHostnode,
    selectedHostnodeId,
    selectedLocation,
    selectedLocationId,
    sshKey,
    storageGb,
    vcpuCount,
    windowsPassword,
  ]);

  const estimatedHourly = useMemo(() => {
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
      title: 'Tạo VPS GPU trên TensorDock',
      description: `Instance ${instanceName.trim()} sẽ được tạo trực tiếp trên tài khoản TensorDock cấu hình trong server. Kiểm tra kỹ GPU, hệ điều hành và network trước khi tiếp tục.`,
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
      const result = await response.json();
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
        description: `Instance ${instanceId} sẽ bị xóa khỏi TensorDock. Thao tác này không thể hoàn tác.`,
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
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Thao tác instance thất bại');
      }
      toast.success('Đã gửi lệnh tới TensorDock');
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
        eyebrow="TensorDock GPU Cloud"
        title="Thuê VPS GPU mạnh cho AI, game và render"
        description="Tạo VPS GPU TensorDock trực tiếp từ TRUNGTAMMMO. Chọn location/hostnode, network, hệ điều hành và xem payload API trước khi gửi lệnh."
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
          { label: 'Hostnodes', value: String(hostnodes.length), hint: 'Máy chủ deploy trực tiếp', tone: 'emerald' },
          { label: 'Instances', value: String(instances.length), hint: 'VM đang quản lý', tone: 'violet' },
          { label: 'Est. Hourly', value: formatUsd(estimatedHourly), hint: 'Ước tính theo GPU/resource', tone: 'amber' },
        ]}
      />

      {loadError ? (
        <SectionPanel className="border-amber-500/25 bg-amber-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">TensorDock chưa sẵn sàng</div>
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

      <SectionPanel className="space-y-6">
        <SectionHeader
          eyebrow="Instance Creation"
          title="Configure Your Instance"
          description="Ba nhóm bên dưới sẽ thay đổi trực tiếp payload POST /api/v2/instances."
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
            title="Operating System"
            options={osOptions}
            value={operatingSystem}
            onChange={setOperatingSystem}
          />
        </div>
      </SectionPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Resources"
            title="Cấu hình VPS GPU"
            description="Storage tối thiểu 100GB. Location-based cần ít nhất 1 GPU; Ubuntu cần SSH key, Windows cần password."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên instance">
              <Input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} />
            </Field>

            <Field label={deploymentMethod === 'location' ? 'Location ID' : 'Hostnode ID'}>
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
                      {hostnode.engine || 'Hostnode'} · {formatLocation(hostnode.location)}
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

            {networkMode === 'port-forwarding' ? (
              <Field label="Port forwarding">
                <Input value={portList} onChange={(event) => setPortList(event.target.value)} placeholder="22, 8080" />
              </Field>
            ) : (
              <MetricCard
                label="Dedicated IP"
                value="Enabled"
                hint="Payload sẽ gửi useDedicatedIp: true"
                tone="blue"
                icon={<ShieldCheck className="h-4 w-4" />}
                className="p-4"
              />
            )}

            {operatingSystem === 'ubuntu2404' ? (
              <Field label="SSH key secret ID">
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
                  {!sshKeySecrets.length ? <option value="">Nhập secret ID bên dưới</option> : null}
                </select>
                <Input
                  className="mt-2"
                  value={sshKey}
                  onChange={(event) => setSshKey(event.target.value)}
                  placeholder="sshkey placeholder"
                />
              </Field>
            ) : (
              <Field label="Windows password">
                <Input
                  type="password"
                  value={windowsPassword}
                  onChange={(event) => setWindowsPassword(event.target.value)}
                  placeholder="MySecureP@ssw0rd123!"
                />
              </Field>
            )}
          </div>

          <Field label="Cloud init JSON optional">
            <textarea
              value={cloudInitJson}
              onChange={(event) => setCloudInitJson(event.target.value)}
              rows={5}
              placeholder='{"package_update":true,"packages":["curl","git"],"runcmd":["nvidia-smi"]}'
              className="field-elevated w-full rounded-[1.2rem] px-4 py-3 font-mono text-xs font-semibold leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
            />
          </Field>
        </SectionPanel>

        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Generated API Request"
            title="POST /api/v2/instances"
            description="Payload này được gửi qua server nội bộ, server sẽ tự gắn Bearer token TensorDock."
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
          description="Theo dõi và gửi lệnh start, stop hoặc delete tới TensorDock."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          }
        />

        {loading ? (
          <EmptyState title="Đang tải TensorDock" description="Hệ thống đang lấy locations, hostnodes, secrets và instances." icon={<Loader2 className="h-5 w-5 animate-spin" />} />
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
            description="Chọn cấu hình bên trên rồi tạo instance mới. Khi TensorDock trả instance, danh sách sẽ hiện tại đây."
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
