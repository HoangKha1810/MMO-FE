import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeRows, tableExists } from '@/lib/legacy-modules';
import {
  getSmmProviderBalance,
  getSmmProviderMultipleOrdersStatus,
  listSmmServices,
} from '@/lib/smm-provider';
import { runDailyAdminAnomalyDigest, runDailyAdminAnomalyDigestWithOptions } from '@/lib/admin-anomaly-digest';
import { runDdosGuard } from '@/lib/admin-ddos-guard';
import { reconcilePendingSePayDeposits } from '@/lib/sepay-deposit-sync';
import { applySmmProviderStatusToOrder } from '@/lib/smm-refund';
import { toNumber } from '@/lib/utils';
import { runVpsGpuHourlyBilling } from '@/lib/vps-gpu-billing';
import { getVietnamDatabaseDateTime } from '@/lib/date-time';

type CronSummary = Record<string, unknown>;

interface SmmOrderRow extends Record<string, unknown> {
  id: number;
  provider_id: number | null;
  api_order_id: string | null;
  status: string | null;
}

interface ProviderRow extends Record<string, unknown> {
  id: number;
  name: string | null;
}

function authorized(req: NextRequest) {
  const expectedKey = String(process.env.CRON_SECRET || process.env.API_KEY || '').trim();
  if (!expectedKey) {
    return false;
  }

  const authorization = String(req.headers.get('authorization') || '').replace(/^bearer\s+/i, '').trim();
  const receivedKey = String(
    req.headers.get('x-cron-secret') ||
    req.headers.get('x-api-key') ||
    authorization ||
    req.nextUrl.searchParams.get('key') ||
    ''
  ).trim();

  return receivedKey === expectedKey;
}

function normalizeTask(value: unknown) {
  const task = String(value || 'all').trim().toLowerCase();
  return task || 'all';
}

function parseBooleanFlag(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function extractOrderStatus(payload: Record<string, unknown>, orderId: string) {
  const direct = payload[orderId];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  if ('status' in payload || 'charge' in payload || 'start_count' in payload || 'remains' in payload) {
    return payload;
  }

  return null;
}

async function runSmmOrderSync() {
  if (!(await tableExists('smm_orders'))) return { scanned: 0, updated: 0, errors: [] };

  const rows = await safeRows<SmmOrderRow>(`
    SELECT id, provider_id, api_order_id, status
    FROM smm_orders
    WHERE api_order_id IS NOT NULL
      AND api_order_id <> ''
      AND LOWER(status) IN ('pending', 'processing', 'in progress', 'in_progress', 'inprogress', 'running', 'active')
    ORDER BY updated_at ASC, id ASC
    LIMIT 120
  `);

  const groups = new Map<number, SmmOrderRow[]>();
  for (const row of rows) {
    const providerId = Math.max(0, Math.trunc(toNumber(row.provider_id, 0)));
    groups.set(providerId, [...(groups.get(providerId) || []), row]);
  }

  let updated = 0;
  let refunded = 0;
  const errors: string[] = [];

  for (const [providerId, providerOrders] of groups.entries()) {
    const orderIds = providerOrders.map((row) => String(row.api_order_id || '').trim()).filter(Boolean);
    if (!orderIds.length) continue;

    try {
      const payload = await getSmmProviderMultipleOrdersStatus(orderIds, providerId || undefined);

      for (const order of providerOrders) {
        const apiOrderId = String(order.api_order_id || '').trim();
        const statusPayload = extractOrderStatus(payload, apiOrderId);
        if (!statusPayload) continue;

        const result = await applySmmProviderStatusToOrder(order.id, statusPayload, {
          fallbackStatus: order.status,
          source: 'cron_smm_order_sync',
        });
        if (result.refunded) refunded += 1;
        updated += 1;
      }
    } catch (error) {
      errors.push(`provider_${providerId}: ${error instanceof Error ? error.message : 'sync failed'}`);
    }
  }

  return { scanned: rows.length, updated, refunded, errors };
}

async function runSmmServiceSync() {
  try {
    const services = await listSmmServices(true);
    return { synced: services.length };
  } catch (error) {
    return { synced: 0, error: error instanceof Error ? error.message : 'sync failed' };
  }
}

async function runProviderHealth() {
  if (!(await tableExists('api_providers'))) return { checked: 0, online: 0, errors: [] };

  const providers = await safeRows<ProviderRow>(`
    SELECT id, name
    FROM api_providers
    WHERE service_type = 'smm'
      AND status = 'active'
    ORDER BY id ASC
  `);

  let online = 0;
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const balance = await getSmmProviderBalance(provider.id);
      await db.$executeRawUnsafe(
        `
          UPDATE api_providers
          SET last_test = NOW(), last_sync = NOW(), health_status = 'online'
          WHERE id = ?
        `,
        provider.id
      ).catch(() => 0);
      await db.activity_logs.create({
        data: {
          activity: `Provider ${provider.name || provider.id} balance check: ${JSON.stringify(balance).slice(0, 600)}`,
          user_agent: 'cron-provider-health',
        },
      }).catch(() => undefined);
      online += 1;
    } catch (error) {
      await db.$executeRawUnsafe(
        `
          UPDATE api_providers
          SET last_test = NOW(), health_status = 'error'
          WHERE id = ?
        `,
        provider.id
      ).catch(() => 0);
      errors.push(`${provider.name || provider.id}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  return { checked: providers.length, online, errors };
}

async function runForumAdsExpiry() {
  if (!(await tableExists('forum_ads'))) return 0;
  return db.$executeRawUnsafe(`
    UPDATE forum_ads
    SET status = 'expired'
    WHERE status = 'approved'
      AND active_to IS NOT NULL
      AND active_to < NOW()
  `).catch(() => 0);
}

async function runAutoMxhMaintenance() {
  if (!(await tableExists('automxh_orders'))) return { stale: 0, cleaned_files: 0 };

  const [stale, cleanedFiles] = await Promise.all([
    db.$executeRawUnsafe(`
      UPDATE automxh_orders
      SET status = 'canceled', updated_at = NOW()
      WHERE status IN ('pending', 'processing')
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `).catch(() => 0),
    db.$executeRawUnsafe(`
      UPDATE automxh_orders
      SET avatar_path = NULL, additional_files = NULL, updated_at = NOW()
      WHERE file_delete_at IS NOT NULL
        AND file_delete_at < NOW()
        AND (avatar_path IS NOT NULL OR additional_files IS NOT NULL)
    `).catch(() => 0),
  ]);

  return { stale: Number(stale || 0), cleaned_files: Number(cleanedFiles || 0) };
}

async function runResourceMaintenance() {
  if (!(await tableExists('resource_orders'))) return { expired_orders: 0 };
  const expired = await db.$executeRawUnsafe(`
    UPDATE resource_orders
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('completed', 'success')
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
  `).catch(() => 0);
  return { expired_orders: Number(expired || 0) };
}

type MmoProviderCronScope = 'random1k' | 'shopreg61' | 'game-account-api';

function buildMmoProviderScopeWhere(scope: MmoProviderCronScope) {
  if (scope === 'random1k') {
    return `
      AND (
        LOWER(COALESCE(name, '')) LIKE '%random1k%'
        OR LOWER(COALESCE(name, '')) LIKE '%random 1k%'
        OR LOWER(COALESCE(type, '')) LIKE '%random1k%'
        OR LOWER(COALESCE(api_url, '')) LIKE '%random1k.com%'
      )
    `;
  }

  if (scope === 'shopreg61') {
    return `
      AND (
        LOWER(COALESCE(name, '')) LIKE '%shopreg61%'
        OR LOWER(COALESCE(type, '')) LIKE '%shopreg%'
        OR LOWER(COALESCE(api_url, '')) LIKE '%shopreg61.com%'
      )
    `;
  }

  return `
    AND (
      LOWER(COALESCE(name, '')) LIKE '%random1k%'
      OR LOWER(COALESCE(name, '')) LIKE '%random 1k%'
      OR LOWER(COALESCE(name, '')) LIKE '%shopreg61%'
      OR LOWER(COALESCE(type, '')) LIKE '%gameaccount%'
      OR LOWER(COALESCE(type, '')) LIKE '%random1k%'
      OR LOWER(COALESCE(type, '')) LIKE '%shopreg%'
      OR LOWER(COALESCE(api_url, '')) LIKE '%random1k.com%'
      OR LOWER(COALESCE(api_url, '')) LIKE '%shopreg61.com%'
    )
  `;
}

async function runMmoResourceSync(scope?: MmoProviderCronScope) {
  const { syncMmoResourcesFromProviders } = await import('@/lib/mmo-provider');
  if (!scope) return syncMmoResourcesFromProviders();

  const providers = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>(`
    SELECT id
    FROM api_providers
    WHERE service_type = 'mmo'
      AND status = 'active'
      ${buildMmoProviderScopeWhere(scope)}
    ORDER BY id ASC
  `);
  const summary = {
    providers: 0,
    categories: 0,
    products: 0,
    disabled_categories: 0,
    disabled_products: 0,
  };

  for (const provider of providers) {
    const result = await syncMmoResourcesFromProviders({ providerId: Number(provider.id) });
    summary.providers += Number(result.providers || 0);
    summary.categories += Number(result.categories || 0);
    summary.products += Number(result.products || 0);
    summary.disabled_categories += Number(result.disabled_categories || 0);
    summary.disabled_products += Number(result.disabled_products || 0);
  }

  return summary;
}

async function runFindJobMaintenance() {
  if (!(await tableExists('find_job_jobs'))) return { expired_jobs: 0 };
  const expired = await db.$executeRawUnsafe(`
    UPDATE find_job_jobs
    SET status = 'closed', updated_at = NOW()
    WHERE status IN ('open', 'pending', 'active')
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
  `).catch(() => 0);
  return { expired_jobs: Number(expired || 0) };
}

async function runSupportTikTokMaintenance() {
  if (!(await tableExists('tiktok_support_orders'))) return { expired_orders: 0 };
  const nowText = getVietnamDatabaseDateTime();
  const expired = await db.$executeRawUnsafe(
    `
      UPDATE tiktok_support_orders
      SET status = 'expired', updated_at = ?
      WHERE status IN ('pending', 'active', 'processing')
        AND ngay_het_han IS NOT NULL
        AND ngay_het_han < ?
    `,
    nowText,
    nowText
  ).catch(() => 0);
  return { expired_orders: Number(expired || 0) };
}

async function runCardMaintenance() {
  if (!(await tableExists('card_orders'))) return { stale_cards: 0, note: 'card_orders table missing' };
  const stale = await db.$executeRawUnsafe(`
    UPDATE card_orders
    SET status = 'failed'
    WHERE status IN ('pending', 'processing')
      AND created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
  `).catch(() => 0);
  return { stale_cards: Number(stale || 0) };
}

async function runDepositMaintenance() {
  const sepay = await reconcilePendingSePayDeposits({ limit: 30 }).catch((error) => ({
    checked: 0,
    processed: 0,
    already_processed: 0,
    failed: 0,
    still_pending: 0,
    missing_remote: 0,
    skipped: false,
    reason: '',
    errors: [error instanceof Error ? error.message : 'SePay reconcile failed'],
  }));

  const stale = await db.transactions.deleteMany({
    where: {
      type: 'deposit',
      status: 'pending',
      created_at: {
        lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    },
  }).catch(() => ({ count: 0 }));

  return {
    deleted_stale_pending_deposits: Number(stale.count || 0),
    sepay,
  };
}

async function runDdosMaintenance() {
  return runDdosGuard({
    autoBlock: true,
    sendEmail: true,
  });
}

async function runTask(task: string, options: { force?: boolean } = {}): Promise<CronSummary> {
  const shouldRun = (name: string) => task === 'all' || task === name;
  const summary: CronSummary = {};

  if (shouldRun('smm-orders')) summary.smm_orders = await runSmmOrderSync();
  if (shouldRun('smm-services')) summary.smm_services = await runSmmServiceSync();
  if (shouldRun('providers')) summary.providers = await runProviderHealth();
  if (shouldRun('automxh')) summary.automxh = await runAutoMxhMaintenance();
  if (shouldRun('resources')) summary.resources = await runResourceMaintenance();
  if (task === 'random1k') summary.mmo_resources_sync = await runMmoResourceSync('random1k');
  else if (task === 'shopreg61') summary.mmo_resources_sync = await runMmoResourceSync('shopreg61');
  else if (task === 'game-account-api') summary.mmo_resources_sync = await runMmoResourceSync('game-account-api');
  else if (shouldRun('mmo-resources')) summary.mmo_resources_sync = await runMmoResourceSync();
  if (shouldRun('find-job')) summary.find_job = await runFindJobMaintenance();
  if (shouldRun('support-tiktok')) summary.support_tiktok = await runSupportTikTokMaintenance();
  if (shouldRun('forum-ads')) summary.forum_ads = { expired: Number(await runForumAdsExpiry() || 0) };
  if (shouldRun('card')) summary.card = await runCardMaintenance();
  if (shouldRun('deposits')) summary.deposits = await runDepositMaintenance();
  if (shouldRun('ddos-guard')) summary.ddos_guard = await runDdosMaintenance();
  if (shouldRun('vps-gpu')) summary.vps_gpu = await runVpsGpuHourlyBilling();
  if (shouldRun('admin-digest')) {
    summary.admin_digest = options.force
      ? await runDailyAdminAnomalyDigestWithOptions({ force: true, markSent: true, subjectPrefix: '[FORCED]' })
      : await runDailyAdminAnomalyDigest();
  }
  if (task === 'admin-digest-test') {
    summary.admin_digest_test = await runDailyAdminAnomalyDigestWithOptions({
      force: true,
      markSent: false,
      subjectPrefix: '[TEST]',
    });
  }

  if (!Object.keys(summary).length) {
    summary.message = `Task '${task}' không tồn tại`;
  }

  return summary;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, message: 'Invalid API key' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const task = normalizeTask((body as Record<string, unknown>).task || req.nextUrl.searchParams.get('task'));
  const force = parseBooleanFlag((body as Record<string, unknown>).force || req.nextUrl.searchParams.get('force'));
  const startedAt = Date.now();
  const summary = await runTask(task, { force });

  await db.activity_logs.create({
    data: {
      activity: `Cron task ${task}: ${JSON.stringify(summary).slice(0, 1200)}`,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: req.headers.get('user-agent') || 'cron',
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    task,
    duration_ms: Date.now() - startedAt,
    data: summary,
  });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, message: 'Invalid API key' }, { status: 401 });
  }

  const task = normalizeTask(req.nextUrl.searchParams.get('task'));
  const force = parseBooleanFlag(req.nextUrl.searchParams.get('force'));
  const startedAt = Date.now();
  const summary = await runTask(task, { force });

  await db.activity_logs.create({
    data: {
      activity: `Cron task ${task}: ${JSON.stringify(summary).slice(0, 1200)}`,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: req.headers.get('user-agent') || 'cron',
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    task,
    duration_ms: Date.now() - startedAt,
    data: summary,
  });
}
