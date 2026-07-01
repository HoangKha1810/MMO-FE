import { db } from '@/lib/db';
import { serializeAbsoluteDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { safeRows, tableExists } from '@/lib/legacy-modules';
import { toNumber } from '@/lib/utils';

export interface AdminPeriodStats {
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
  resource_revenue: number;
  resource_orders: number;
  game_revenue: number;
  game_orders: number;
  support_revenue: number;
  support_orders: number;
  forum_posts: number;
  forum_threads: number;
  new_users: number;
  deposit: number;
  deposit_pending: number;
  spent: number;
  refunds_money: number;
  active_users: number;
  success_rate: number;
}

export interface AdminDashboardStats {
  pulse: {
    total_users: number;
    online_users: number;
    locked_users: number;
    twofa_users: number;
    total_liability: number;
    realtime_orders: number;
    smm_delayed: number;
    blacklisted_ips: number;
    pending_reports: number;
    pending_deposits: number;
  };
  statsToday: AdminPeriodStats;
  stats7d: AdminPeriodStats;
  stats30d: AdminPeriodStats;
  topUsers: Array<{
    username: string;
    balance: number;
    role: string;
  }>;
  activityLogs: Array<{
    id: number;
    activity: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    user: {
      username: string;
      role: string;
    } | null;
  }>;
  generatedAt: string;
  databaseUrl: string;
}

type MetricRow = Record<string, unknown>;

type PeriodStartSql = 'CURDATE()' | 'DATE_SUB(CURDATE(), INTERVAL 7 DAY)' | 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)';

const INVALID_ORDER_STATUS_SQL = "('failed', 'error', 'cancelled', 'canceled', 'refunded', 'refund', 'partial', 'cancel', 'rejected', 'deleted')";
const SUCCESS_ORDER_STATUS_SQL = "('success', 'completed', 'done', 'complete', 'active')";
const PENDING_ORDER_STATUS_SQL = "('pending', 'wait', 'waiting')";
const PROCESSING_ORDER_STATUS_SQL = "('processing', 'in progress', 'progress', 'running')";
const OPEN_ORDER_STATUS_SQL = "('pending', 'wait', 'waiting', 'processing', 'in progress', 'progress', 'running')";
const tableColumnCache = new Map<string, Set<string>>();

function sqlIdentifier(value: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

function columnRef(column: string, alias = '') {
  return `${alias}${sqlIdentifier(column)}`;
}

async function getTableColumns(table: string) {
  const cacheKey = table.toLowerCase();
  const cached = tableColumnCache.get(cacheKey);
  if (cached) return cached;

  const columns = new Set<string>();
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !(await tableExists(table))) {
    tableColumnCache.set(cacheKey, columns);
    return columns;
  }

  try {
    const rows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `
        SELECT COLUMN_NAME AS column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
      `,
      table
    );

    for (const row of rows) {
      if (row.column_name) {
        columns.add(String(row.column_name));
      }
    }
  } catch {
    // Keep dashboard resilient when a legacy table is unavailable.
  }

  tableColumnCache.set(cacheKey, columns);
  return columns;
}

function firstAvailableColumn(columns: Set<string>, candidates: string[], alias = '') {
  const column = candidates.find((candidate) => columns.has(candidate));
  return column ? columnRef(column, alias) : '0';
}

function moneyExpression(columns: Set<string>, candidates: string[], alias = '') {
  const column = firstAvailableColumn(columns, candidates, alias);
  return column === '0' ? '0' : `COALESCE(${column}, 0)`;
}

function hasColumn(columns: Set<string>, column: string) {
  return columns.has(column);
}

function statusCondition(columns: Set<string>, statusSql: string, alias = '') {
  if (!hasColumn(columns, 'status')) return '0';
  return `LOWER(COALESCE(${columnRef('status', alias)}, '')) IN ${statusSql}`;
}

function validOrderCondition(columns: Set<string>, alias = '') {
  if (!hasColumn(columns, 'status')) return '1 = 1';
  return `LOWER(COALESCE(${columnRef('status', alias)}, '')) NOT IN ${INVALID_ORDER_STATUS_SQL}`;
}

function createdAtFilter(columns: Set<string>, startSql: PeriodStartSql, alias = '') {
  if (!hasColumn(columns, 'created_at')) return '1 = 1';
  return `${columnRef('created_at', alias)} >= ${startSql}`;
}

function blankPeriodStats(): AdminPeriodStats {
  return {
    smm_revenue: 0,
    smm_cost: 0,
    smm_profit: 0,
    smm_total: 0,
    smm_success: 0,
    smm_pending: 0,
    smm_processing: 0,
    smm_refunded: 0,
    amx_revenue: 0,
    amx_cost: 0,
    amx_profit: 0,
    amx_success: 0,
    amx_failed: 0,
    amx_pending: 0,
    amx_total: 0,
    resource_revenue: 0,
    resource_orders: 0,
    game_revenue: 0,
    game_orders: 0,
    support_revenue: 0,
    support_orders: 0,
    forum_posts: 0,
    forum_threads: 0,
    new_users: 0,
    deposit: 0,
    deposit_pending: 0,
    spent: 0,
    refunds_money: 0,
    active_users: 0,
    success_rate: 0,
  };
}

function first(rows: MetricRow[]) {
  return rows[0] || {};
}

function numberFrom(row: MetricRow, key: string) {
  return Math.max(0, toNumber(row[key], 0));
}

function iso(value: unknown) {
  const serialized = serializeDatabaseDateTime(value);
  return serialized || serializeAbsoluteDateTime(new Date());
}

function publicDatabaseUrl() {
  const value = process.env.DATABASE_URL || '';
  return value.replace(/mysql:\/\/([^:]+):([^@]+)@/, 'mysql://$1:***@');
}

async function getPeriodStats(startSql: PeriodStartSql): Promise<AdminPeriodStats> {
  const [
    smmColumns,
    smmCacheColumns,
    autoColumns,
    resourceColumns,
    gameColumns,
    supportColumns,
  ] = await Promise.all([
    getTableColumns('smm_orders'),
    getTableColumns('smm_services_cache'),
    getTableColumns('automxh_orders'),
    getTableColumns('resource_orders'),
    getTableColumns('game_market_orders'),
    getTableColumns('tiktok_support_orders'),
  ]);

  const smmRevenueExpression = moneyExpression(smmColumns, ['price', 'amount', 'total_price'], 'o.');
  const smmRefundExpression = moneyExpression(smmColumns, ['refund_amount'], 'o.');
  const smmQuantityExpression = moneyExpression(smmColumns, ['quantity'], 'o.');
  const smmJoinSql = hasColumn(smmColumns, 'provider_id') &&
    hasColumn(smmColumns, 'service_id') &&
    hasColumn(smmCacheColumns, 'provider_id') &&
    hasColumn(smmCacheColumns, 'service_id')
    ? `LEFT JOIN smm_services_cache c ON c.provider_id = o.provider_id AND c.service_id = o.service_id`
    : '';
  const smmCostRateExpression = smmJoinSql ? firstAvailableColumn(smmCacheColumns, ['rate', 'cost_price', 'price'], 'c.') : '0';
  const smmValidCondition = hasColumn(smmColumns, 'is_refunded')
    ? `${validOrderCondition(smmColumns, 'o.')} AND COALESCE(${columnRef('is_refunded', 'o.')}, 0) = 0`
    : validOrderCondition(smmColumns, 'o.');

  const autoRevenueExpression = moneyExpression(autoColumns, ['amount', 'price', 'total_price'], '');
  const autoCostExpression = moneyExpression(autoColumns, ['cost_price', 'cost', 'provider_cost'], '');
  const autoValidCondition = validOrderCondition(autoColumns);

  const resourceRevenueExpression = moneyExpression(resourceColumns, ['total_price', 'amount', 'price'], '');
  const resourceValidCondition = validOrderCondition(resourceColumns);

  const gameRevenueExpression = moneyExpression(gameColumns, ['amount', 'total_price', 'price'], '');
  const gameValidCondition = validOrderCondition(gameColumns);

  const supportRevenueExpression = moneyExpression(supportColumns, ['price', 'total_price', 'amount'], '');
  const supportValidCondition = validOrderCondition(supportColumns);

  const [
    smmRows,
    autoRows,
    transactionRows,
    userRows,
    forumRows,
    resourceRows,
    gameRows,
    supportRows,
  ] = await Promise.all([
    safeRows<MetricRow>(`
      SELECT
        COUNT(*) AS smm_total,
        COALESCE(SUM(CASE WHEN ${smmValidCondition} THEN ${smmRevenueExpression} ELSE 0 END), 0) AS smm_revenue,
        COALESCE(SUM(
          CASE
            WHEN ${smmValidCondition} THEN (${smmQuantityExpression} / 1000) * COALESCE(${smmCostRateExpression}, 0)
            ELSE 0
          END
        ), 0) AS smm_cost,
        COALESCE(SUM(CASE WHEN ${statusCondition(smmColumns, SUCCESS_ORDER_STATUS_SQL, 'o.')} THEN 1 ELSE 0 END), 0) AS smm_success,
        COALESCE(SUM(CASE WHEN ${statusCondition(smmColumns, PENDING_ORDER_STATUS_SQL, 'o.')} THEN 1 ELSE 0 END), 0) AS smm_pending,
        COALESCE(SUM(CASE WHEN ${statusCondition(smmColumns, PROCESSING_ORDER_STATUS_SQL, 'o.')} THEN 1 ELSE 0 END), 0) AS smm_processing,
        COALESCE(SUM(CASE WHEN NOT (${smmValidCondition}) THEN 1 ELSE 0 END), 0) AS smm_refunded,
        COALESCE(SUM(${smmRefundExpression}), 0) AS smm_refunds
      FROM smm_orders o
      ${smmJoinSql}
      WHERE o.created_at >= ${startSql}
    `),
    safeRows<MetricRow>(`
      SELECT
        COUNT(*) AS amx_total,
        COALESCE(SUM(CASE WHEN ${autoValidCondition} THEN ${autoRevenueExpression} ELSE 0 END), 0) AS amx_revenue,
        COALESCE(SUM(CASE WHEN ${autoValidCondition} THEN ${autoCostExpression} ELSE 0 END), 0) AS amx_cost,
        COALESCE(SUM(CASE WHEN ${statusCondition(autoColumns, SUCCESS_ORDER_STATUS_SQL)} THEN 1 ELSE 0 END), 0) AS amx_success,
        COALESCE(SUM(CASE WHEN NOT (${autoValidCondition}) THEN 1 ELSE 0 END), 0) AS amx_failed,
        COALESCE(SUM(CASE WHEN ${statusCondition(autoColumns, OPEN_ORDER_STATUS_SQL)} THEN 1 ELSE 0 END), 0) AS amx_pending
      FROM automxh_orders
      WHERE ${createdAtFilter(autoColumns, startSql)}
    `),
    safeRows<MetricRow>(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'deposit' AND status = 'success' THEN amount ELSE 0 END), 0) AS deposit,
        COALESCE(SUM(CASE WHEN type = 'deposit' AND status = 'pending' THEN amount ELSE 0 END), 0) AS deposit_pending,
        COALESCE(SUM(CASE WHEN type = 'refund' AND status = 'success' THEN ABS(amount) ELSE 0 END), 0) AS refunds_money,
        COALESCE(SUM(CASE WHEN type = 'order' AND status = 'success' THEN ABS(amount) ELSE 0 END), 0) AS spent,
        COALESCE(SUM(CASE WHEN type = 'order' AND status = 'success' AND COALESCE(content, '') LIKE '%SMM%' THEN ABS(amount) ELSE 0 END), 0) AS smm_spent,
        COALESCE(SUM(CASE WHEN type = 'order' AND status = 'success' AND (COALESCE(content, '') LIKE '%Auto MXH%' OR COALESCE(content, '') LIKE '%AutoMXH%') THEN ABS(amount) ELSE 0 END), 0) AS amx_spent,
        COALESCE(SUM(CASE WHEN type = 'order' AND status = 'success' AND COALESCE(content, '') LIKE '%Mua tài nguyên%' THEN ABS(amount) ELSE 0 END), 0) AS resource_spent,
        COALESCE(SUM(CASE WHEN type = 'order' AND status = 'success' AND (COALESCE(content, '') LIKE '%Mua tài khoản game/random%' OR COALESCE(content, '') LIKE '%Mua game account%') THEN ABS(amount) ELSE 0 END), 0) AS game_spent,
        COALESCE(SUM(CASE WHEN type = 'order' AND status = 'success' AND COALESCE(content, '') LIKE '%Support TikTok%' THEN ABS(amount) ELSE 0 END), 0) AS support_spent
      FROM transactions
      WHERE created_at >= ${startSql}
    `),
    safeRows<MetricRow>(`
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= ${startSql} THEN 1 ELSE 0 END), 0) AS new_users,
        COALESCE(SUM(CASE WHEN COALESCE(last_activity, last_login) >= ${startSql} THEN 1 ELSE 0 END), 0) AS active_users
      FROM users
    `),
    safeRows<MetricRow>(`
      SELECT
        (SELECT COUNT(*) FROM forum_posts WHERE COALESCE(is_deleted, 0) = 0 AND created_at >= ${startSql}) AS forum_posts,
        (SELECT COUNT(*) FROM forum_threads WHERE COALESCE(is_deleted, 0) = 0 AND created_at >= ${startSql}) AS forum_threads
    `),
    safeRows<MetricRow>(`
      SELECT
        COUNT(*) AS resource_orders,
        COALESCE(SUM(CASE WHEN ${resourceValidCondition} THEN ${resourceRevenueExpression} ELSE 0 END), 0) AS resource_revenue
      FROM resource_orders
      WHERE ${createdAtFilter(resourceColumns, startSql)}
    `),
    safeRows<MetricRow>(`
      SELECT
        COUNT(*) AS game_orders,
        COALESCE(SUM(CASE WHEN ${gameValidCondition} THEN ${gameRevenueExpression} ELSE 0 END), 0) AS game_revenue
      FROM game_market_orders
      WHERE ${createdAtFilter(gameColumns, startSql)}
    `),
    safeRows<MetricRow>(`
      SELECT
        COUNT(*) AS support_orders,
        COALESCE(SUM(CASE WHEN ${supportValidCondition} THEN ${supportRevenueExpression} ELSE 0 END), 0) AS support_revenue
      FROM tiktok_support_orders
      WHERE ${createdAtFilter(supportColumns, startSql)}
    `),
  ]);

  const smm = first(smmRows);
  const auto = first(autoRows);
  const transactions = first(transactionRows);
  const users = first(userRows);
  const forum = first(forumRows);
  const resource = first(resourceRows);
  const game = first(gameRows);
  const support = first(supportRows);

  const stats = blankPeriodStats();
  stats.smm_revenue = numberFrom(transactions, 'smm_spent');
  stats.smm_cost = numberFrom(smm, 'smm_cost');
  stats.smm_profit = stats.smm_revenue - stats.smm_cost;
  stats.smm_total = numberFrom(smm, 'smm_total');
  stats.smm_success = numberFrom(smm, 'smm_success');
  stats.smm_pending = numberFrom(smm, 'smm_pending');
  stats.smm_processing = numberFrom(smm, 'smm_processing');
  stats.smm_refunded = numberFrom(smm, 'smm_refunded');
  stats.refunds_money = numberFrom(transactions, 'refunds_money') || numberFrom(smm, 'smm_refunds');

  stats.amx_revenue = numberFrom(transactions, 'amx_spent');
  stats.amx_cost = numberFrom(auto, 'amx_cost');
  stats.amx_profit = stats.amx_revenue - stats.amx_cost;
  stats.amx_success = numberFrom(auto, 'amx_success');
  stats.amx_failed = numberFrom(auto, 'amx_failed');
  stats.amx_pending = numberFrom(auto, 'amx_pending');
  stats.amx_total = numberFrom(auto, 'amx_total');

  stats.deposit = numberFrom(transactions, 'deposit');
  stats.deposit_pending = numberFrom(transactions, 'deposit_pending');
  stats.new_users = numberFrom(users, 'new_users');
  stats.active_users = numberFrom(users, 'active_users');
  stats.forum_posts = numberFrom(forum, 'forum_posts');
  stats.forum_threads = numberFrom(forum, 'forum_threads');
  stats.resource_orders = numberFrom(resource, 'resource_orders');
  stats.resource_revenue = numberFrom(transactions, 'resource_spent');
  stats.game_orders = numberFrom(game, 'game_orders');
  stats.game_revenue = numberFrom(transactions, 'game_spent');
  stats.support_orders = numberFrom(support, 'support_orders');
  stats.support_revenue = numberFrom(transactions, 'support_spent');
  stats.spent = numberFrom(transactions, 'spent');

  const totalOrders = stats.smm_total + stats.amx_total + stats.resource_orders + stats.game_orders + stats.support_orders;
  const successfulOrders = stats.smm_success + stats.amx_success + stats.resource_orders + stats.game_orders + stats.support_orders;
  stats.success_rate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;

  return stats;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  try {
    const now = new Date();

    const [
      statsToday,
      stats7d,
      stats30d,
      totalUsersRows,
      onlineUsersRows,
      lockedUsersRows,
      twofaRows,
      liabilityRows,
      blacklistRows,
      pendingReportsRows,
      pendingDepositRows,
      delayedSmmRows,
      topUsersRows,
      activityRows,
    ] = await Promise.all([
      getPeriodStats('CURDATE()'),
      getPeriodStats('DATE_SUB(CURDATE(), INTERVAL 7 DAY)'),
      getPeriodStats('DATE_SUB(CURDATE(), INTERVAL 30 DAY)'),
      safeRows<MetricRow>('SELECT COUNT(*) AS total FROM users'),
      safeRows<MetricRow>(`
        SELECT COUNT(*) AS total
        FROM users
        WHERE status = 'active'
          AND COALESCE(last_activity, last_login) >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      `),
      safeRows<MetricRow>("SELECT COUNT(*) AS total FROM users WHERE status IN ('banned', 'locked', 'suspended')"),
      safeRows<MetricRow>('SELECT COUNT(*) AS total FROM users WHERE COALESCE(`2fa_enabled`, 0) = 1 OR COALESCE(telegram_2fa_enabled, 0) = 1'),
      safeRows<MetricRow>('SELECT COALESCE(SUM(balance), 0) AS total FROM users'),
      safeRows<MetricRow>(`
        SELECT
          (SELECT COUNT(*) FROM ip_blacklist) +
          (SELECT COUNT(*) FROM banned_ips WHERE expire_at IS NULL OR expire_at > NOW()) AS total
      `),
      safeRows<MetricRow>(`
        SELECT
          (SELECT COUNT(*) FROM forum_reports WHERE status = 'pending') +
          (SELECT COUNT(*) FROM forum_threads WHERE status = 'pending') AS total
      `),
      safeRows<MetricRow>("SELECT COUNT(*) AS total FROM transactions WHERE type = 'deposit' AND status = 'pending'"),
      safeRows<MetricRow>(`
        SELECT COUNT(*) AS total
        FROM smm_orders
        WHERE LOWER(COALESCE(status, '')) IN ('processing', 'in progress', 'progress', 'running', 'pending')
          AND COALESCE(updated_at, created_at) < DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `),
      safeRows<MetricRow>(`
        SELECT username, COALESCE(balance, 0) AS balance, COALESCE(role, 'member') AS role
        FROM users
        ORDER BY balance DESC
        LIMIT 5
      `),
      safeRows<MetricRow>(`
        SELECT al.id, al.activity, al.ip_address, al.user_agent, al.created_at, u.username, u.role
        FROM activity_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 60
      `),
    ]);

    return {
      pulse: {
        total_users: numberFrom(first(totalUsersRows), 'total'),
        online_users: numberFrom(first(onlineUsersRows), 'total'),
        locked_users: numberFrom(first(lockedUsersRows), 'total'),
        twofa_users: numberFrom(first(twofaRows), 'total'),
        total_liability: numberFrom(first(liabilityRows), 'total'),
        realtime_orders: statsToday.smm_total,
        smm_delayed: numberFrom(first(delayedSmmRows), 'total'),
        blacklisted_ips: numberFrom(first(blacklistRows), 'total'),
        pending_reports: numberFrom(first(pendingReportsRows), 'total'),
        pending_deposits: numberFrom(first(pendingDepositRows), 'total'),
      },
      statsToday,
      stats7d,
      stats30d,
      topUsers: topUsersRows.map((row) => ({
        username: String(row.username || 'Unknown'),
        balance: numberFrom(row, 'balance'),
        role: String(row.role || 'member'),
      })),
      activityLogs: activityRows.map((row) => ({
        id: Math.trunc(numberFrom(row, 'id')),
        activity: String(row.activity || ''),
        ip_address: row.ip_address ? String(row.ip_address) : null,
        user_agent: row.user_agent ? String(row.user_agent) : null,
        created_at: iso(row.created_at),
        user: row.username
          ? {
              username: String(row.username),
              role: String(row.role || 'member'),
            }
          : null,
      })),
      generatedAt: now.toISOString(),
      databaseUrl: publicDatabaseUrl(),
    };
  } catch (error) {
    console.error('Admin stats error:', error);
    const empty = blankPeriodStats();
    return {
      pulse: {
        total_users: 0,
        online_users: 0,
        locked_users: 0,
        twofa_users: 0,
        total_liability: 0,
        realtime_orders: 0,
        smm_delayed: 0,
        blacklisted_ips: 0,
        pending_reports: 0,
        pending_deposits: 0,
      },
      statsToday: empty,
      stats7d: empty,
      stats30d: empty,
      topUsers: [],
      activityLogs: [],
      generatedAt: new Date().toISOString(),
      databaseUrl: publicDatabaseUrl(),
    };
  }
}
