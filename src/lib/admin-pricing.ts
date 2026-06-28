import { type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/admin-auth';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { buildRandom1kResourceWhereSql } from '@/lib/random1k';
import { DEFAULT_SMM_PRICE_MULTIPLIER, MAX_SMM_PRICE_DECIMAL_15_4, buildSmmPriceFromMargin } from '@/lib/smm-pricing';
import { toNumber } from '@/lib/utils';

type PricingFieldKind = 'money' | 'percent' | 'number';
type PricingStatusKind = 'string' | 'boolean';

interface PricingFieldConfig {
  key: string;
  label: string;
  column: string;
  kind: PricingFieldKind;
  editable?: boolean;
  primary?: boolean;
  selectExpression?: string;
  hint?: string;
}

interface PricingModuleConfig {
  key: string;
  label: string;
  description: string;
  table: string;
  idColumn?: string;
  icon: string;
  tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan' | 'slate';
  titleExpression: string;
  subtitleExpression?: string;
  categoryExpression?: string;
  statusColumn?: string;
  statusKind?: PricingStatusKind;
  updatedAtColumn?: string;
  searchColumns: string[];
  baseWhere?: string[];
  fields: PricingFieldConfig[];
}

export interface PricingModule {
  key: string;
  label: string;
  description: string;
  icon: string;
  tone: PricingModuleConfig['tone'];
  count: number;
  fields: Array<Omit<PricingFieldConfig, 'column' | 'selectExpression'> & { editable: boolean }>;
  status: {
    enabled: boolean;
    kind: PricingStatusKind;
    label: string;
  };
}

interface PricingListParams {
  module?: string;
  search?: string;
  platform?: string;
  provider?: string;
  category?: string;
  page?: number;
  perPage?: number;
}

interface PricingActionInput {
  module?: string;
  id?: number;
  ids?: number[];
  fields?: Record<string, unknown>;
  status?: unknown;
  action?: string;
  percent?: number;
  targetField?: string;
  scope?: 'selected' | 'filtered';
  search?: string;
  confirm?: boolean;
}

const tableColumnCache = new Map<string, Set<string> | null>();

interface PricingCategoryRow {
  id: number;
  parent_id: number | null;
  name: string;
}

const pricingModuleConfigs: PricingModuleConfig[] = [
  {
    key: 'smm',
    label: 'SMM Provider',
    description: 'Giá bán / 1K cho toàn bộ service SMM từ SubMetaVip và provider đang bật.',
    table: 'smm_services_cache',
    icon: 'zap',
    tone: 'blue',
    titleExpression: "COALESCE(NULLIF(`name`, ''), CONCAT('Service #', `service_id`))",
    subtitleExpression: "CONCAT(COALESCE(`category`, 'Chưa phân loại'), ' · Provider ', COALESCE(`provider_id`, 0), ' · #', `service_id`)",
    categoryExpression: "COALESCE(`category`, 'Chưa phân loại')",
    statusColumn: 'status',
    updatedAtColumn: 'cached_at',
    searchColumns: ['name', 'original_name', 'category', 'type', 'service_id'],
    baseWhere: ['COALESCE(`is_deleted`, 0) = 0'],
    fields: [
      {
        key: 'custom_price',
        label: 'Giá bán / 1K',
        column: 'custom_price',
        kind: 'money',
        editable: true,
        primary: true,
        selectExpression: `COALESCE(NULLIF(\`custom_price\`, 0), ROUND(COALESCE(\`rate\`, 0) * ${DEFAULT_SMM_PRICE_MULTIPLIER}, 4))`,
        hint: 'Giá bán mặc định = giá gốc SubMetaVip + 60%. Lưu vào custom_price để sync provider không ghi đè.',
      },
      {
        key: 'rate',
        label: 'Giá gốc provider / 1K',
        column: 'rate',
        kind: 'money',
        editable: false,
      },
      {
        key: 'margin_percent',
        label: 'Margin %',
        column: 'margin_percent',
        kind: 'percent',
        editable: true,
      },
    ],
  },
  {
    key: 'automxh-products',
    label: 'Auto MXH Products',
    description: 'Giá gốc của từng product Auto MXH.',
    table: 'automxh_products',
    icon: 'bolt',
    tone: 'amber',
    titleExpression: "COALESCE(`name`, CONCAT('Auto product #', `id`))",
    subtitleExpression: "CONCAT('Category ', COALESCE(`category_id`, 0), ' · API ', COALESCE(`api_service_id`, ''))",
    categoryExpression: "CAST(COALESCE(`category_id`, 0) AS CHAR)",
    statusColumn: 'status',
    updatedAtColumn: 'updated_at',
    searchColumns: ['name', 'description', 'type', 'api_service_id'],
    baseWhere: ['COALESCE(`is_deleted`, 0) = 0'],
    fields: [
      { key: 'price', label: 'Giá bán', column: 'price', kind: 'money', editable: true, primary: true },
      { key: 'cost', label: 'Giá vốn', column: 'cost', kind: 'money', editable: true },
    ],
  },
  {
    key: 'automxh-variants',
    label: 'Auto MXH Variants',
    description: 'Giá từng gói/variant Auto MXH dùng khi đặt đơn.',
    table: 'automxh_variants',
    icon: 'layers',
    tone: 'amber',
    titleExpression: "COALESCE(`name`, CONCAT('Variant #', `id`))",
    subtitleExpression: "CONCAT('Product ', COALESCE(`product_id`, 0), ' · Qty ', COALESCE(`quantity`, 0), ' · API ', COALESCE(`api_service_id`, ''))",
    categoryExpression: "CAST(COALESCE(`product_id`, 0) AS CHAR)",
    statusColumn: 'status',
    updatedAtColumn: 'updated_at',
    searchColumns: ['name', 'description', 'badge', 'type', 'api_service_id'],
    baseWhere: ['COALESCE(`is_deleted`, 0) = 0'],
    fields: [
      { key: 'price', label: 'Giá bán', column: 'price', kind: 'money', editable: true, primary: true },
      { key: 'cost', label: 'Giá vốn', column: 'cost', kind: 'money', editable: true },
      { key: 'original_price', label: 'Giá gốc hiển thị', column: 'original_price', kind: 'money', editable: true },
    ],
  },
  {
    key: 'resources',
    label: 'Tài nguyên MMO',
    description: 'Giá sản phẩm trong kho mmo_resources.',
    table: 'mmo_resources',
    icon: 'package',
    tone: 'violet',
    titleExpression: "COALESCE(`title`, CONCAT('Resource #', `id`))",
    subtitleExpression: "CONCAT(COALESCE(`category`, 'Resource'), ' · ', COALESCE(`product_code`, ''))",
    categoryExpression: "COALESCE(`category`, 'Resource')",
    statusColumn: 'status',
    updatedAtColumn: 'updated_at',
    searchColumns: ['title', 'description', 'category', 'product_code', 'tags'],
    baseWhere: ['COALESCE(`is_deleted`, 0) = 0'],
    fields: [
      { key: 'price', label: 'Giá bán', column: 'price', kind: 'money', editable: true, primary: true },
      { key: 'original_price', label: 'Giá gốc', column: 'original_price', kind: 'money', editable: true },
      { key: 'margin_percent', label: 'Margin %', column: 'margin_percent', kind: 'percent', editable: true },
    ],
  },
  {
    key: 'game-account-api-products',
    label: 'Thuê tài khoản game 99 năm API',
    description: 'Giá thuê toàn bộ sản phẩm đồng bộ từ API tài khoản game, hỗ trợ tăng/giảm hàng loạt theo %.',
    table: 'mmo_resources',
    icon: 'shuffle',
    tone: 'cyan',
    titleExpression: "COALESCE(`title`, CONCAT('Game API product #', `id`))",
    subtitleExpression: "CONCAT(COALESCE(`category`, 'Tài khoản game thuê 99 năm'), ' · API ', COALESCE(`api_product_id`, ''))",
    categoryExpression: "COALESCE(`category`, 'Tài khoản game thuê 99 năm')",
    statusColumn: 'status',
    updatedAtColumn: 'updated_at',
    searchColumns: ['title', 'description', 'category', 'product_code', 'tags', 'api_product_id', 'custom_badge'],
    baseWhere: ['COALESCE(`is_deleted`, 0) = 0', buildRandom1kResourceWhereSql(null, null)],
    fields: [
      { key: 'price', label: 'Giá bán', column: 'price', kind: 'money', editable: true, primary: true },
      { key: 'original_price', label: 'Giá vốn API', column: 'original_price', kind: 'money', editable: false },
      { key: 'margin_percent', label: 'Margin %', column: 'margin_percent', kind: 'percent', editable: true },
    ],
  },
  {
    key: 'game-market',
    label: 'Game Market',
    description: 'Giá listing game, account, vật phẩm trong game_market_items.',
    table: 'game_market_items',
    icon: 'gamepad',
    tone: 'emerald',
    titleExpression: "COALESCE(`title`, CONCAT('Game item #', `id`))",
    subtitleExpression: "CONCAT(COALESCE(`category`, 'Game'), ' · ', COALESCE(`code`, ''))",
    categoryExpression: "COALESCE(`category`, 'Game')",
    statusColumn: 'status',
    updatedAtColumn: 'updated_at',
    searchColumns: ['title', 'category', 'tag', 'badge', 'code'],
    fields: [
      { key: 'price', label: 'Giá bán', column: 'price', kind: 'money', editable: true, primary: true },
      { key: 'original_price', label: 'Giá gốc', column: 'original_price', kind: 'money', editable: true },
    ],
  },
  {
    key: 'support-tiktok',
    label: 'Support TikTok',
    description: 'Giá các service theo region trong module Support TikTok.',
    table: 'tiktok_region_services',
    icon: 'headset',
    tone: 'cyan',
    titleExpression: "COALESCE(`name`, CONCAT('TikTok service #', `id`))",
    subtitleExpression: "CONCAT(COALESCE(`region_slug`, ''), ' · ', COALESCE(`service_key`, ''))",
    categoryExpression: "COALESCE(`region_slug`, 'TikTok')",
    statusColumn: 'status',
    updatedAtColumn: 'updated_at',
    searchColumns: ['name', 'service_key', 'region_slug', 'description'],
    fields: [
      { key: 'price', label: 'Giá bán', column: 'price', kind: 'money', editable: true, primary: true },
    ],
  },
  {
    key: 'legacy-services',
    label: 'Service Legacy',
    description: 'Các dịch vụ generic trong bảng services của source PHP cũ.',
    table: 'services',
    icon: 'workflow',
    tone: 'slate',
    titleExpression: "COALESCE(`name`, CONCAT('Service #', `id`))",
    subtitleExpression: "CONCAT(COALESCE(`category`, 'Legacy'), ' · Provider ', COALESCE(`provider_id`, 0))",
    categoryExpression: "COALESCE(`category`, 'Legacy')",
    statusColumn: 'status',
    updatedAtColumn: 'created_at',
    searchColumns: ['name', 'description', 'category', 'provider_service_id'],
    fields: [
      { key: 'price', label: 'Giá bán', column: 'price', kind: 'money', editable: true, primary: true },
      { key: 'cost_price', label: 'Giá vốn', column: 'cost_price', kind: 'money', editable: true },
    ],
  },
  {
    key: 'card-rates',
    label: 'Thẻ cào',
    description: 'Tỷ lệ thẻ cào theo nhà mạng/mệnh giá.',
    table: 'card_rates',
    icon: 'credit-card',
    tone: 'rose',
    titleExpression: "CONCAT(COALESCE(`telco`, 'CARD'), ' ', COALESCE(`value`, 0))",
    subtitleExpression: "CONCAT('Loại ', COALESCE(`type`, 'auto'))",
    categoryExpression: "COALESCE(`telco`, 'CARD')",
    statusColumn: 'is_active',
    statusKind: 'boolean',
    updatedAtColumn: 'created_at',
    searchColumns: ['telco', 'type', 'value'],
    fields: [
      { key: 'rate_exchange', label: 'Tỷ lệ nạp %', column: 'rate_exchange', kind: 'percent', editable: true, primary: true },
      { key: 'rate_buy', label: 'Tỷ lệ mua %', column: 'rate_buy', kind: 'percent', editable: true },
    ],
  },
  {
    key: 'forum-ads',
    label: 'Forum Ads',
    description: 'Giá thuê quảng cáo forum theo duration.',
    table: 'forum_ads',
    icon: 'megaphone',
    tone: 'violet',
    titleExpression: "CONCAT('Ads #', `id`, ' · ', COALESCE(`duration_days`, 0), ' ngày')",
    subtitleExpression: "COALESCE(`link_url`, 'Forum placement')",
    categoryExpression: "COALESCE(`status`, 'ads')",
    statusColumn: 'status',
    updatedAtColumn: 'uploaded_at',
    searchColumns: ['link_url', 'status', 'reject_reason'],
    fields: [
      { key: 'price_vnd', label: 'Giá ads', column: 'price_vnd', kind: 'money', editable: true, primary: true },
    ],
  },
  {
    key: 'vps-products',
    label: 'VPS Products',
    description: 'Giá base của sản phẩm VPS remote nếu module VPS đang bật.',
    table: 'vps_remote_products',
    idColumn: 'id',
    icon: 'server',
    tone: 'cyan',
    titleExpression: "COALESCE(`name`, CONCAT('VPS #', `id`))",
    subtitleExpression: "CONCAT(COALESCE(`category`, 'VPS'), ' · ', COALESCE(`region`, ''))",
    categoryExpression: "COALESCE(`category`, 'VPS')",
    updatedAtColumn: 'synced_at',
    searchColumns: ['name', 'slug', 'category', 'region'],
    fields: [
      { key: 'base_price', label: 'Giá base', column: 'base_price', kind: 'money', editable: true, primary: true },
    ],
  },
];

function escapeIdentifier(value: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error('Identifier không hợp lệ');
  }
  return `\`${value}\``;
}

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizeRecord(value: unknown): unknown {
  if (value instanceof Date) return serializeDatabaseDateTime(value);
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(normalizeRecord);
  if (value && typeof value === 'object') {
    if ('toNumber' in value && typeof value.toNumber === 'function') {
      return toNumber(value, 0);
    }
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) output[key] = normalizeRecord(item);
    return output;
  }
  return value;
}

async function getTableColumns(table: string) {
  const cached = tableColumnCache.get(table);
  if (cached !== undefined) return cached;

  try {
    const rows = await db.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM ${escapeIdentifier(table)}`);
    const columns = new Set(rows.map((row) => row.Field));
    tableColumnCache.set(table, columns);
    return columns;
  } catch {
    return null;
  }
}

async function resolveConfig(key: string) {
  const config = pricingModuleConfigs.find((item) => item.key === key);
  if (!config) throw new Error('Module giá không được hỗ trợ');
  const columns = await getTableColumns(config.table);
  if (!columns?.has(config.idColumn || 'id')) throw new Error(`Bảng ${config.table} chưa khả dụng`);
  return { config, columns };
}

function filterAvailableFields(config: PricingModuleConfig, columns: Set<string>) {
  return config.fields.filter((field) => columns.has(field.column));
}

function getPrimaryField(config: PricingModuleConfig, columns: Set<string>) {
  const fields = filterAvailableFields(config, columns);
  return fields.find((field) => field.primary && field.editable !== false) || fields.find((field) => field.editable !== false) || fields[0];
}

function buildWhereSql(
  config: PricingModuleConfig,
  columns: Set<string>,
  input: {
    search?: string;
    platform?: string;
    provider?: string;
    category?: string;
    categoryValues?: string[];
    ids?: number[];
  } = {}
) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const idColumn = config.idColumn || 'id';

  for (const condition of config.baseWhere || []) {
    conditions.push(condition);
  }

  const search = String(input.search || '').trim();
  if (search) {
    const searchConditions = config.searchColumns
      .filter((column) => columns.has(column))
      .map((column) => `CAST(${escapeIdentifier(column)} AS CHAR) LIKE ?`);
    values.push(...searchConditions.map(() => `%${search}%`));

    const numericSearch = Number(search);
    if (Number.isFinite(numericSearch) && columns.has(idColumn)) {
      searchConditions.push(`${escapeIdentifier(idColumn)} = ?`);
      values.push(numericSearch);
    }

    if (searchConditions.length > 0) {
      conditions.push(`(${searchConditions.join(' OR ')})`);
    }
  }

  if (input.ids?.length) {
    conditions.push(`${escapeIdentifier(idColumn)} IN (${input.ids.map(() => '?').join(', ')})`);
    values.push(...input.ids);
  }

  const category = String(input.category || '').trim();
  if (category && columns.has('category')) {
    conditions.push(`${escapeIdentifier('category')} = ?`);
    values.push(category);
  }

  const categoryValues = (input.categoryValues || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (categoryValues.length > 0) {
    if (config.key === 'automxh-products' && columns.has('category_id')) {
      conditions.push(`${escapeIdentifier('category_id')} IN (${categoryValues.map(() => '?').join(', ')})`);
      values.push(...categoryValues);
    } else if (config.key === 'automxh-variants' && columns.has('product_id')) {
      conditions.push(`${escapeIdentifier('product_id')} IN (${categoryValues.map(() => '?').join(', ')})`);
      values.push(...categoryValues);
    }
  }

  const provider = String(input.provider || '').trim();
  if (provider && config.key === 'smm' && columns.has('provider_id')) {
    conditions.push(`CAST(${escapeIdentifier('provider_id')} AS CHAR) = ?`);
    values.push(provider);
  }

  const platform = String(input.platform || '').trim().toLowerCase();
  if (platform && config.key === 'smm' && columns.has('category')) {
    const categorySql = escapeIdentifier('category');
    if (platform === 'facebook') conditions.push(`(${categorySql} LIKE '[FB]%' OR ${categorySql} LIKE '%Facebook%')`);
    if (platform === 'tiktok') conditions.push(`(${categorySql} LIKE '[TT]%' OR ${categorySql} LIKE '%TikTok%')`);
    if (platform === 'instagram') conditions.push(`(${categorySql} LIKE '[IG]%' OR ${categorySql} LIKE '%Instagram%')`);
    if (platform === 'youtube') conditions.push(`(${categorySql} LIKE '[YT]%' OR ${categorySql} LIKE '%Youtube%' OR ${categorySql} LIKE '%YouTube%')`);
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

function buildCategoryMeta(rows: PricingCategoryRow[]) {
  const byId = new Map<number, PricingCategoryRow>();
  rows.forEach((row) => byId.set(Number(row.id), row));

  const resolvePath = (id: number): string => {
    const visited = new Set<number>();
    const parts: string[] = [];
    let current = byId.get(id);

    while (current && !visited.has(Number(current.id))) {
      visited.add(Number(current.id));
      const name = String(current.name || '').trim();
      if (name) parts.unshift(name);
      const parentId = toNumber(current.parent_id, 0);
      current = parentId > 0 ? byId.get(parentId) : undefined;
    }

    return parts.join(' > ');
  };

  const descendantMap = new Map<number, number[]>();
  for (const row of rows) {
    const rowId = Number(row.id);
    const path = resolvePath(rowId);
    descendantMap.set(rowId, [rowId]);
    for (const other of rows) {
      const otherId = Number(other.id);
      const otherPath = resolvePath(otherId);
      if (otherId !== rowId && otherPath.startsWith(`${path} > `)) {
        descendantMap.set(rowId, [...(descendantMap.get(rowId) || [rowId]), otherId]);
      }
    }
  }

  return {
    options: rows
      .map((row) => ({
        value: String(row.id),
        label: resolvePath(Number(row.id)) || String(row.name || `#${row.id}`),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'vi')),
    descendants: descendantMap,
    resolvePath,
  };
}

async function getAutoMxhCategoryMeta() {
  const columns = await getTableColumns('automxh_categories');
  if (!columns?.has('id') || !columns.has('name')) {
    return null;
  }

  const rows = await db.$queryRawUnsafe<PricingCategoryRow[]>(
    `
      SELECT id, ${columns.has('parent_id') ? 'parent_id' : 'NULL AS parent_id'}, name
      FROM \`automxh_categories\`
      ${columns.has('is_deleted') ? 'WHERE COALESCE(`is_deleted`, 0) = 0' : ''}
      ORDER BY ${columns.has('sort_order') ? 'COALESCE(`sort_order`, 0), ' : ''}id ASC
    `
  ).catch(() => []);

  if (!rows.length) return null;
  return buildCategoryMeta(rows);
}

function buildFieldSelect(field: PricingFieldConfig) {
  const expression = field.selectExpression || escapeIdentifier(field.column);
  return `${expression} AS ${escapeIdentifier(`field_${field.key}`)}`;
}

function buildListSelect(config: PricingModuleConfig, columns: Set<string>) {
  const idColumn = config.idColumn || 'id';
  const fields = filterAvailableFields(config, columns);
  const statusSql = config.statusColumn && columns.has(config.statusColumn)
    ? escapeIdentifier(config.statusColumn)
    : 'NULL';
  const updatedAtSql = config.updatedAtColumn && columns.has(config.updatedAtColumn)
    ? escapeIdentifier(config.updatedAtColumn)
    : 'NULL';

  return [
    `${escapeIdentifier(idColumn)} AS id`,
    `${sqlLiteral(config.key)} AS module_key`,
    `${sqlLiteral(config.label)} AS module_label`,
    `${config.titleExpression} AS name`,
    `${config.subtitleExpression || 'NULL'} AS subtitle`,
    `${config.categoryExpression || 'NULL'} AS category`,
    `${statusSql} AS status`,
    `${updatedAtSql} AS updated_at`,
    ...fields.map(buildFieldSelect),
  ].join(', ');
}

export async function listPricingModules(): Promise<PricingModule[]> {
  const modules: PricingModule[] = [];

  for (const config of pricingModuleConfigs) {
    const columns = await getTableColumns(config.table);
    if (!columns?.has(config.idColumn || 'id')) continue;

    const fields = filterAvailableFields(config, columns);
    if (fields.length === 0 || !getPrimaryField(config, columns)) continue;

    const { whereSql, values } = buildWhereSql(config, columns);
    const countRows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total FROM ${escapeIdentifier(config.table)} ${whereSql}`,
      ...values
    ).catch(() => [{ total: 0 }]);

    modules.push({
      key: config.key,
      label: config.label,
      description: config.description,
      icon: config.icon,
      tone: config.tone,
      count: Number(countRows[0]?.total || 0),
      fields: fields.map(({ column: _column, selectExpression: _selectExpression, editable, ...field }) => ({
        ...field,
        editable: editable !== false,
      })),
      status: {
        enabled: Boolean(config.statusColumn && columns.has(config.statusColumn)),
        kind: config.statusKind || 'string',
        label: config.statusColumn || 'status',
      },
    });
  }

  return modules;
}

export async function listPricingItems(params: PricingListParams) {
  const modules = await listPricingModules();
  if (modules.length === 0) {
    return {
      success: true,
      modules: [],
      active_module: null,
      data: [],
      pagination: { page: 1, per_page: 50, total: 0, total_pages: 1 },
      summary: { min: 0, max: 0, avg: 0 },
    };
  }

  const requestedModule = params.module && modules.some((module) => module.key === params.module)
    ? params.module
    : modules[0].key;
  const { config, columns } = await resolveConfig(requestedModule);
  const autoMxhCategoryMeta = requestedModule.startsWith('automxh-') ? await getAutoMxhCategoryMeta() : null;
  const page = Math.max(1, Math.trunc(params.page || 1));
  const perPage = Math.min(100, Math.max(10, Math.trunc(params.perPage || 50)));
  const skip = (page - 1) * perPage;
  const categoryValues = autoMxhCategoryMeta && params.category
    ? autoMxhCategoryMeta.descendants.get(Number(params.category))?.map((item) => String(item)) || [String(params.category)]
    : [];
  const { whereSql, values } = buildWhereSql(config, columns, {
    search: params.search,
    platform: params.platform,
    provider: params.provider,
    category: params.category,
    categoryValues,
  });
  const selectSql = buildListSelect(config, columns);
  const primaryField = getPrimaryField(config, columns);
  const primaryExpression = primaryField?.selectExpression || (primaryField ? escapeIdentifier(primaryField.column) : '0');

  const [rows, countRows, summaryRows] = await Promise.all([
    db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ${selectSql}
       FROM ${escapeIdentifier(config.table)}
       ${whereSql}
       ORDER BY ${config.statusColumn && columns.has(config.statusColumn) ? `${escapeIdentifier(config.statusColumn)} ASC, ` : ''}${escapeIdentifier(config.idColumn || 'id')} DESC
       LIMIT ? OFFSET ?`,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total FROM ${escapeIdentifier(config.table)} ${whereSql}`,
      ...values
    ),
    db.$queryRawUnsafe<Array<{ min_price: unknown; max_price: unknown; avg_price: unknown }>>(
      `SELECT MIN(${primaryExpression}) AS min_price, MAX(${primaryExpression}) AS max_price, AVG(${primaryExpression}) AS avg_price
       FROM ${escapeIdentifier(config.table)}
       ${whereSql}`,
      ...values
    ),
  ]);

  const activeModule = modules.find((module) => module.key === requestedModule)!;
  const total = Number(countRows[0]?.total || 0);
  const data = rows.map((row) => {
    const valuesByField: Record<string, unknown> = {};
    for (const field of activeModule.fields) {
      valuesByField[field.key] = normalizeRecord(row[`field_${field.key}`]);
    }

    return {
      id: Number(row.id),
      module: row.module_key,
      module_label: row.module_label,
      name: normalizeRecord(row.name),
      subtitle: normalizeRecord(row.subtitle),
      category: requestedModule.startsWith('automxh-') && autoMxhCategoryMeta
        ? autoMxhCategoryMeta.resolvePath(toNumber(row.category, 0)) || normalizeRecord(row.category)
        : normalizeRecord(row.category),
      status: normalizeRecord(row.status),
      updated_at: normalizeRecord(row.updated_at),
      values: valuesByField,
    };
  });

  return {
    success: true,
    modules,
    active_module: activeModule,
    data,
    filters: requestedModule === 'smm'
      ? {
          provider_options: Array.from(new Set(
            rows
              .map((row) => String(row.subtitle || ''))
              .map((text) => {
                const match = text.match(/Provider\s+([^·]+)/i);
                return match?.[1]?.trim() || '';
              })
              .filter(Boolean)
          )).sort((left, right) => left.localeCompare(right, 'vi')),
          platform_options: ['Facebook', 'TikTok', 'Instagram', 'YouTube'],
          category_options: Array.from(new Set(
            rows
              .map((row) => String(row.category || '').trim())
              .filter(Boolean)
          )).sort((left, right) => left.localeCompare(right, 'vi')),
        }
      : requestedModule.startsWith('automxh-') && autoMxhCategoryMeta
        ? {
            category_options: autoMxhCategoryMeta.options.map((item) => item.label),
            category_map: Object.fromEntries(autoMxhCategoryMeta.options.map((item) => [item.label, item.value])),
          }
      : undefined,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
    summary: {
      min: toNumber(summaryRows[0]?.min_price, 0),
      max: toNumber(summaryRows[0]?.max_price, 0),
      avg: toNumber(summaryRows[0]?.avg_price, 0),
    },
  };
}

function normalizeNumericInput(value: unknown, kind: PricingFieldKind) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toNumber(value, Number.NaN);
  if (!Number.isFinite(parsed)) throw new Error('Giá trị giá không hợp lệ');
  if ((kind === 'money' || kind === 'number') && parsed < 0) throw new Error('Giá trị không được âm');
  return Math.round(parsed * 10000) / 10000;
}

function buildSafeSmmMarginPriceSql(rateExpression: string) {
  return `LEAST(${MAX_SMM_PRICE_DECIMAL_15_4}, ROUND(COALESCE(${rateExpression}, 0) * (1 + (? / 100)), 4))`;
}

function normalizeStatus(value: unknown, kind: PricingStatusKind) {
  if (kind === 'boolean') {
    if (value === true || value === 1 || value === '1' || value === 'true' || value === 'active') return 1;
    return 0;
  }

  return String(value || '').trim();
}

async function readPricingItem(config: PricingModuleConfig, columns: Set<string>, id: number) {
  const selectSql = buildListSelect(config, columns);
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${selectSql} FROM ${escapeIdentifier(config.table)} WHERE ${escapeIdentifier(config.idColumn || 'id')} = ? LIMIT 1`,
    id
  );
  return normalizeRecord(rows[0] || { id });
}

export async function updatePricingItem(input: PricingActionInput, adminId: number, req: NextRequest) {
  const moduleKey = String(input.module || '').trim();
  const id = Number(input.id || 0);
  if (!moduleKey || !id) throw new Error('Thiếu module hoặc ID dịch vụ');

  const { config, columns } = await resolveConfig(moduleKey);
  const fields = filterAvailableFields(config, columns);
  const editableFields = new Map(fields.filter((field) => field.editable !== false).map((field) => [field.key, field]));
  const setSql: string[] = [];
  const values: unknown[] = [];

  const fieldPatch = input.fields && typeof input.fields === 'object' ? input.fields : {};
  const isSmmModule = moduleKey === 'smm';
  const hasMarginColumn = columns.has('margin_percent');
  const hasAutoMarginColumn = columns.has('is_auto_margin');
  const priceField = fields.find((field) => field.key === 'custom_price') || fields.find((field) => field.primary);
  const providerRateField = fields.find((field) => field.key === 'rate');
  const requestedMarginValue = Object.prototype.hasOwnProperty.call(fieldPatch, 'margin_percent')
    ? normalizeNumericInput(fieldPatch.margin_percent, 'percent')
    : null;
  let nextCustomPriceForSmm: number | null = null;

  if (isSmmModule && requestedMarginValue !== null && priceField && providerRateField) {
    const currentRows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ${providerRateField.selectExpression || escapeIdentifier(providerRateField.column)} AS provider_rate
       FROM ${escapeIdentifier(config.table)}
       WHERE ${escapeIdentifier(config.idColumn || 'id')} = ?
       LIMIT 1`,
      id
    );
    const providerRate = toNumber(currentRows[0]?.provider_rate, 0);
    nextCustomPriceForSmm = buildSmmPriceFromMargin(providerRate, requestedMarginValue);
  }

  for (const [key, value] of Object.entries(fieldPatch)) {
    const field = editableFields.get(key);
    if (!field) continue;
    if (isSmmModule && key === 'custom_price' && requestedMarginValue !== null) continue;
    setSql.push(`${escapeIdentifier(field.column)} = ?`);
    values.push(normalizeNumericInput(value, field.kind));
  }

  if (isSmmModule && requestedMarginValue !== null && hasMarginColumn) {
    if (hasAutoMarginColumn) {
      setSql.push(`${escapeIdentifier('is_auto_margin')} = ?`);
      values.push(1);
    }
    if (priceField && nextCustomPriceForSmm !== null) {
      setSql.push(`${escapeIdentifier(priceField.column)} = ?`);
      values.push(nextCustomPriceForSmm);
    }
  }

  if (input.status !== undefined && config.statusColumn && columns.has(config.statusColumn)) {
    setSql.push(`${escapeIdentifier(config.statusColumn)} = ?`);
    values.push(normalizeStatus(input.status, config.statusKind || 'string'));
  }

  if (setSql.length === 0) throw new Error('Không có field giá hợp lệ để cập nhật');

  if (columns.has('updated_at')) {
    setSql.push('`updated_at` = NOW()');
  } else if (columns.has('cached_at')) {
    setSql.push('`cached_at` = NOW()');
  }

  await db.$executeRawUnsafe(
    `UPDATE ${escapeIdentifier(config.table)}
     SET ${setSql.join(', ')}
     WHERE ${escapeIdentifier(config.idColumn || 'id')} = ?`,
    ...values,
    id
  );

  if (moduleKey === 'smm') {
    const { clearSmmServicesCache } = await import('@/lib/smm-provider');
    clearSmmServicesCache();
  }

  await logAdminAction({
    adminId,
    action: `update pricing ${moduleKey}`,
    target: `#${id}`,
    req,
  });

  return {
    success: true,
    data: await readPricingItem(config, columns, id),
  };
}

function normalizeIds(input: unknown) {
  return Array.isArray(input)
    ? Array.from(new Set(input.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))
    : [];
}

export async function runPricingAction(input: PricingActionInput, adminId: number, req: NextRequest) {
  const action = String(input.action || '').trim();
  if (action === 'update-one') {
    return updatePricingItem(input, adminId, req);
  }

  const moduleKey = String(input.module || '').trim();
  if (!moduleKey) throw new Error('Thiếu module giá');
  const { config, columns } = await resolveConfig(moduleKey);
  const autoMxhCategoryMeta = moduleKey.startsWith('automxh-') ? await getAutoMxhCategoryMeta() : null;
  const ids = normalizeIds(input.ids);
  const search = String(input.search || '').trim();
  const scope = input.scope || 'selected';
  const category = String((input as Record<string, unknown>).category || '').trim();

  if (scope === 'selected' && ids.length === 0) {
    throw new Error('Chọn ít nhất một dịch vụ để xử lý');
  }

  if (scope === 'filtered' && input.confirm !== true) {
    throw new Error('Cần xác nhận khi áp dụng cho toàn bộ dữ liệu đang lọc');
  }

  const { whereSql, values: whereValues } = buildWhereSql(config, columns, {
    search,
    category,
    categoryValues: autoMxhCategoryMeta && category
      ? autoMxhCategoryMeta.descendants.get(Number(category))?.map((item) => String(item)) || [category]
      : [],
    ids: scope === 'selected' ? ids : undefined,
  });

  const fields = filterAvailableFields(config, columns);
  const targetFieldKey = String(input.targetField || '').trim();
  const targetField =
    fields.find((field) => field.key === targetFieldKey && field.editable !== false) ||
    getPrimaryField(config, columns);

  if (!targetField || targetField.editable === false) {
    throw new Error('Field giá không hợp lệ');
  }

  let affected = 0;

  if (action === 'bulk-percent') {
    const percent = toNumber(input.percent, Number.NaN);
    if (!Number.isFinite(percent) || percent <= -100 || percent > 1000) {
      throw new Error('Phần trăm điều chỉnh không hợp lệ');
    }
    if (moduleKey === 'smm' && targetField.key === 'margin_percent') {
      const rateField = fields.find((field) => field.key === 'rate');
      const customPriceField = fields.find((field) => field.key === 'custom_price');
      const marginValue = Math.round(percent * 10000) / 10000;
      const assignments = [`${escapeIdentifier('margin_percent')} = ?`];
      const assignmentValues: unknown[] = [marginValue];

      if (columns.has('is_auto_margin')) {
        assignments.push(`${escapeIdentifier('is_auto_margin')} = ?`);
        assignmentValues.push(1);
      }

      if (rateField && customPriceField) {
        assignments.push(`${escapeIdentifier(customPriceField.column)} = ${buildSafeSmmMarginPriceSql(escapeIdentifier(rateField.column))}`);
        assignmentValues.push(marginValue);
      }

      affected = Number(await db.$executeRawUnsafe(
        `UPDATE ${escapeIdentifier(config.table)}
         SET ${assignments.join(', ')}
         ${columns.has('updated_at') ? ', `updated_at` = NOW()' : columns.has('cached_at') ? ', `cached_at` = NOW()' : ''}
         ${whereSql}`,
        ...assignmentValues,
        ...whereValues
      ) || 0);
    } else {
      const factor = Math.round((1 + percent / 100) * 1000000) / 1000000;
      const sourceExpression = targetField.selectExpression || escapeIdentifier(targetField.column);
      affected = Number(await db.$executeRawUnsafe(
        `UPDATE ${escapeIdentifier(config.table)}
         SET ${escapeIdentifier(targetField.column)} = ROUND(COALESCE(${sourceExpression}, 0) * ?, 4)
         ${columns.has('updated_at') ? ', \`updated_at\` = NOW()' : columns.has('cached_at') ? ', \`cached_at\` = NOW()' : ''}
         ${whereSql}`,
        factor,
        ...whereValues
      ) || 0);
    }
  } else if (action === 'bulk-set') {
    const nextValue = normalizeNumericInput(input.fields?.[targetField.key], targetField.kind);
    if (moduleKey === 'smm' && targetField.key === 'margin_percent') {
      const rateField = fields.find((field) => field.key === 'rate');
      const customPriceField = fields.find((field) => field.key === 'custom_price');
      const assignments = [`${escapeIdentifier('margin_percent')} = ?`];
      const assignmentValues: unknown[] = [nextValue];

      if (columns.has('is_auto_margin')) {
        assignments.push(`${escapeIdentifier('is_auto_margin')} = ?`);
        assignmentValues.push(1);
      }

      if (rateField && customPriceField) {
        assignments.push(`${escapeIdentifier(customPriceField.column)} = ${buildSafeSmmMarginPriceSql(escapeIdentifier(rateField.column))}`);
        assignmentValues.push(nextValue);
      }

      affected = Number(await db.$executeRawUnsafe(
        `UPDATE ${escapeIdentifier(config.table)}
         SET ${assignments.join(', ')}
         ${columns.has('updated_at') ? ', `updated_at` = NOW()' : columns.has('cached_at') ? ', `cached_at` = NOW()' : ''}
         ${whereSql}`,
        ...assignmentValues,
        ...whereValues
      ) || 0);
    } else {
      affected = Number(await db.$executeRawUnsafe(
        `UPDATE ${escapeIdentifier(config.table)}
         SET ${escapeIdentifier(targetField.column)} = ?
         ${columns.has('updated_at') ? ', `updated_at` = NOW()' : columns.has('cached_at') ? ', `cached_at` = NOW()' : ''}
         ${whereSql}`,
        nextValue,
        ...whereValues
      ) || 0);
    }
  } else {
    throw new Error('Action giá chưa được hỗ trợ');
  }

  if (moduleKey === 'smm') {
    const { clearSmmServicesCache } = await import('@/lib/smm-provider');
    clearSmmServicesCache();
  }

  await logAdminAction({
    adminId,
    action: `${action} pricing ${moduleKey}`,
    target: scope === 'selected' ? `${affected} selected` : `${affected} filtered`,
    req,
  });

  return { success: true, affected };
}
