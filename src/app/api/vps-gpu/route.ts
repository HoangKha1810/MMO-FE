import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { buildTensorDockQuery, isTensorDockConfigured, tensorDockRequest } from '@/lib/tensordock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

async function requireUser() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

function json(data: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...noStoreHeaders,
      ...(init?.headers || {}),
    },
  });
}

function normalizePath(value: string) {
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}

function getAllowedInstanceAction(path: string) {
  const match = path.match(/^instances\/([^/]+)\/(start|stop|modify)$/);
  if (!match) {
    return null;
  }

  return {
    id: match[1],
    action: match[2],
  };
}

async function handleTensorDockError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Không thể kết nối TensorDock';
  const status = message.includes('TENSORDOCK_API_TOKEN') ? 500 : 502;
  return json({ success: false, message }, { status });
}

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isTensorDockConfigured()) {
    return json({ success: false, message: 'Thiếu TENSORDOCK_API_TOKEN' }, { status: 500 });
  }

  const resource = normalizePath(req.nextUrl.searchParams.get('resource') || 'overview');

  try {
    if (resource === 'overview') {
      const [locations, hostnodes, instances, secrets] = await Promise.all([
        tensorDockRequest('/locations'),
        tensorDockRequest('/hostnodes'),
        tensorDockRequest('/instances'),
        tensorDockRequest('/secrets'),
      ]);

      return json({
        success: true,
        data: {
          locations,
          hostnodes,
          instances,
          secrets,
        },
      });
    }

    if (resource === 'locations') {
      const payload = await tensorDockRequest('/locations');
      return json({ success: true, data: payload });
    }

    if (resource === 'hostnodes') {
      const query = buildTensorDockQuery({
        location: req.nextUrl.searchParams.get('location'),
        minRamGb: req.nextUrl.searchParams.get('minRamGb'),
        minVcpu: req.nextUrl.searchParams.get('minVcpu'),
        gpu: req.nextUrl.searchParams.get('gpu'),
      });
      const payload = await tensorDockRequest(`/hostnodes${query}`);
      return json({ success: true, data: payload });
    }

    if (resource.startsWith('hostnodes/')) {
      const hostnodeId = normalizePath(resource.slice('hostnodes/'.length));
      if (!hostnodeId || hostnodeId.includes('/')) {
        return json({ success: false, message: 'Hostnode ID không hợp lệ' }, { status: 400 });
      }
      const payload = await tensorDockRequest(`/hostnodes/${encodeURIComponent(hostnodeId)}`);
      return json({ success: true, data: payload });
    }

    if (resource === 'instances') {
      const payload = await tensorDockRequest('/instances');
      return json({ success: true, data: payload });
    }

    if (resource.startsWith('instances/')) {
      const instanceId = normalizePath(resource.slice('instances/'.length));
      if (!instanceId || instanceId.includes('/')) {
        return json({ success: false, message: 'Instance ID không hợp lệ' }, { status: 400 });
      }
      const payload = await tensorDockRequest(`/instances/${encodeURIComponent(instanceId)}`);
      return json({ success: true, data: payload });
    }

    if (resource === 'secrets') {
      const payload = await tensorDockRequest('/secrets');
      return json({ success: true, data: payload });
    }

    return json({ success: false, message: 'Resource không hợp lệ' }, { status: 400 });
  } catch (error) {
    return handleTensorDockError(error);
  }
}

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isTensorDockConfigured()) {
    return json({ success: false, message: 'Thiếu TENSORDOCK_API_TOKEN' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = normalizePath(String(body?.action || 'create-instance'));

    if (action === 'create-instance') {
      if (!body?.payload || typeof body.payload !== 'object') {
        return json({ success: false, message: 'Payload tạo VPS GPU không hợp lệ' }, { status: 400 });
      }

      const payload = await tensorDockRequest('/instances', {
        method: 'POST',
        body: JSON.stringify(body.payload),
      });
      return json({ success: true, data: payload });
    }

    if (action === 'create-secret') {
      if (!body?.payload || typeof body.payload !== 'object') {
        return json({ success: false, message: 'Payload secret không hợp lệ' }, { status: 400 });
      }

      const payload = await tensorDockRequest('/secrets', {
        method: 'POST',
        body: JSON.stringify(body.payload),
      });
      return json({ success: true, data: payload });
    }

    const instanceAction = getAllowedInstanceAction(action);
    if (instanceAction && ['start', 'stop'].includes(instanceAction.action)) {
      const payload = await tensorDockRequest(
        `/instances/${encodeURIComponent(instanceAction.id)}/${instanceAction.action}`,
        { method: 'POST' }
      );
      return json({ success: true, data: payload });
    }

    return json({ success: false, message: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    return handleTensorDockError(error);
  }
}

export async function PUT(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isTensorDockConfigured()) {
    return json({ success: false, message: 'Thiếu TENSORDOCK_API_TOKEN' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = normalizePath(String(body?.action || ''));
    const instanceAction = getAllowedInstanceAction(action);

    if (!instanceAction || instanceAction.action !== 'modify') {
      return json({ success: false, message: 'Action modify không hợp lệ' }, { status: 400 });
    }

    const payload = await tensorDockRequest(`/instances/${encodeURIComponent(instanceAction.id)}/modify`, {
      method: 'PUT',
      body: JSON.stringify(body.payload || {}),
    });
    return json({ success: true, data: payload });
  } catch (error) {
    return handleTensorDockError(error);
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isTensorDockConfigured()) {
    return json({ success: false, message: 'Thiếu TENSORDOCK_API_TOKEN' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const instanceId = String(body?.instanceId || req.nextUrl.searchParams.get('instanceId') || '').trim();
    const secretId = String(body?.secretId || req.nextUrl.searchParams.get('secretId') || '').trim();

    if (instanceId) {
      const payload = await tensorDockRequest(`/instances/${encodeURIComponent(instanceId)}`, { method: 'DELETE' });
      return json({ success: true, data: payload });
    }

    if (secretId) {
      const payload = await tensorDockRequest(`/secrets/${encodeURIComponent(secretId)}`, { method: 'DELETE' });
      return json({ success: true, data: payload });
    }

    return json({ success: false, message: 'Thiếu instanceId hoặc secretId' }, { status: 400 });
  } catch (error) {
    return handleTensorDockError(error);
  }
}
