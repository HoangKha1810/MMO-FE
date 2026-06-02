const DEFAULT_VAST_API_BASE_URL = 'https://console.vast.ai/api/v0';
const DEFAULT_VAST_API_TIMEOUT_MS = 10000;
const DEFAULT_VAST_IMAGE = 'nvidia/cuda:12.4.1-runtime-ubuntu22.04';

export class VastApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'VastApiError';
    this.status = status;
  }
}

function getVastBaseUrl(version: 'v0' | 'v1' = 'v0') {
  const baseUrl = String(process.env.VAST_API_BASE_URL || DEFAULT_VAST_API_BASE_URL)
    .trim()
    .replace(/\/+$/, '');

  if (version === 'v1') {
    return baseUrl.replace(/\/api\/v0$/i, '/api/v1');
  }

  return baseUrl.replace(/\/api\/v1$/i, '/api/v0');
}

function getVastApiKey() {
  return String(process.env.VAST_API_KEY || '').trim();
}

function getVastTimeoutMs() {
  const parsed = Number(process.env.VAST_API_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VAST_API_TIMEOUT_MS;
}

export function getVastDefaultImage() {
  return String(process.env.VAST_DEFAULT_IMAGE || DEFAULT_VAST_IMAGE).trim();
}

export function isVastConfigured() {
  return Boolean(getVastApiKey());
}

export async function vastRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { version?: 'v0' | 'v1' } = {}
): Promise<T> {
  const apiKey = getVastApiKey();
  if (!apiKey) {
    throw new Error('Thiếu API key nguồn GPU');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getVastTimeoutMs());
  let response: Response;

  try {
    response = await fetch(`${getVastBaseUrl(options.version || 'v0')}${normalizedPath}`, {
      ...init,
      signal: init.signal || controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new VastApiError(
      `Không kết nối được API nguồn GPU ${normalizedPath}. Kiểm tra mạng server, DNS/firewall hoặc endpoint nguồn GPU.`,
      502
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const message = String(record.msg || record.message || record.error || '').trim();
    throw new VastApiError(
      message
        ? `API nguồn GPU ${normalizedPath} trả HTTP ${response.status}: ${message}`
        : `API nguồn GPU ${normalizedPath} trả HTTP ${response.status}`,
      response.status
    );
  }

  return payload as T;
}

export function buildVastOfferSearch(params: {
  gpuName?: string | null;
  minGpus?: string | number | null;
  minGpuRamMb?: string | number | null;
  minDiskGb?: string | number | null;
  minReliability?: string | number | null;
  maxHourlyUsd?: string | number | null;
  limit?: string | number | null;
  type?: 'ondemand' | 'bid';
}) {
  const payload: Record<string, unknown> = {
    rentable: { eq: true },
    verified: { eq: true },
    type: params.type || 'ondemand',
    limit: normalizePositiveInt(params.limit, 40),
    order: [['dph_total', 'asc']],
  };

  const gpuName = String(params.gpuName || '').trim();
  if (gpuName) {
    payload.gpu_name = { in: [gpuName] };
  }

  const minGpus = normalizePositiveInt(params.minGpus, 1);
  if (minGpus > 0) {
    payload.num_gpus = { gte: minGpus };
  }

  const minGpuRamMb = normalizePositiveInt(params.minGpuRamMb, 0);
  if (minGpuRamMb > 0) {
    payload.gpu_ram = { gte: minGpuRamMb };
  }

  const minDiskGb = normalizePositiveInt(params.minDiskGb, 0);
  if (minDiskGb > 0) {
    payload.disk_space = { gte: minDiskGb };
  }

  const maxHourlyUsd = normalizePositiveNumber(params.maxHourlyUsd, 0);
  if (maxHourlyUsd > 0) {
    payload.dph_total = { lte: maxHourlyUsd };
  }

  const minReliability = normalizePositiveNumber(params.minReliability, 0.98);
  if (minReliability > 0) {
    payload.reliability = { gte: minReliability };
  }

  return payload;
}

function normalizePositiveInt(value: string | number | null | undefined, fallback: number) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePositiveNumber(value: string | number | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
