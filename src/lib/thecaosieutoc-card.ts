import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { getLegacySettingsMap, invalidateLegacySettingsCache } from '@/lib/legacy-settings';
import { normalizeLegacyRows, tableExists } from '@/lib/legacy-modules';
import { toNumber } from '@/lib/utils';

const SETTING_DEFAULTS = [
  ['thecaosieutoc_base_url', 'https://thecaosieutoc.vn'],
  ['thecaosieutoc_partner_id', ''],
  ['thecaosieutoc_partner_key', ''],
  ['thecaosieutoc_auto_submit', '1'],
  ['thecaosieutoc_buy_token', ''],
  ['thecaosieutoc_buy_auto_submit', '1'],
] as const;

const SETTING_KEYS = SETTING_DEFAULTS.map(([key]) => key);

export interface TheCaoSieuTocConfig {
  baseUrl: string;
  partnerId: string;
  partnerKey: string;
  autoSubmit: boolean;
  configured: boolean;
  buyToken: string;
  buyAutoSubmit: boolean;
  buyConfigured: boolean;
}

type CardPayload = Record<string, unknown>;

export type TheCaoSieuTocPurchasedCard = {
  type: string;
  amount: number;
  code: string;
  serial: string;
};

function normalizeBoolean(value: unknown, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled', 'active', 'bat', 'bật'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled', 'inactive', 'tat', 'tắt'].includes(normalized)) return false;
  return fallback;
}

function settingValue(settings: Record<string, string>, key: string, envKey: string, fallback = '') {
  const envValue = String(process.env[envKey] || '').trim();
  if (envValue) return envValue;
  return String(settings[key] ?? fallback).trim();
}

export async function ensureTheCaoSieuTocSettings() {
  if (!(await tableExists('settings'))) return;

  for (const [key, value] of SETTING_DEFAULTS) {
    await db.$executeRawUnsafe(
      `
        INSERT INTO settings (setting_key, setting_value, updated_at)
        SELECT ?, ?, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM settings WHERE setting_key = ? LIMIT 1
        )
      `,
      key,
      value,
      key
    ).catch(() => undefined);
  }
}

export async function listTheCaoSieuTocSettings(params: URLSearchParams, page: number, perPage: number, skip: number) {
  await ensureTheCaoSieuTocSettings();

  if (!(await tableExists('settings'))) {
    return {
      success: true,
      title: 'Cấu hình TheCaoSieuToc',
      data: [],
      pagination: { page, per_page: perPage, total: 0, total_pages: 1 },
      readonly: false,
      create_fields: ['setting_key', 'setting_value'],
      update_fields: ['setting_value'],
      warning: 'Bảng settings chưa tồn tại',
    };
  }

  const search = (params.get('search') || '').trim();
  const placeholders = SETTING_KEYS.map(() => '?').join(', ');
  const values: unknown[] = [...SETTING_KEYS];
  const conditions = [`setting_key IN (${placeholders})`];

  if (search) {
    conditions.push('(setting_key LIKE ? OR COALESCE(setting_value, \'\') LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT id, setting_key, setting_value, updated_at
        FROM settings
        ${whereSql}
        ORDER BY FIELD(setting_key, ${placeholders}), id ASC
        LIMIT ? OFFSET ?
      `,
      ...values,
      ...SETTING_KEYS,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total FROM settings ${whereSql}`,
      ...values
    ),
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    success: true,
    title: 'Cấu hình TheCaoSieuToc',
    data: normalizeLegacyRows(rows),
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
    readonly: false,
    create_fields: ['setting_key', 'setting_value'],
    update_fields: ['setting_value'],
  };
}

export async function getTheCaoSieuTocCardConfig(forceRefresh = false): Promise<TheCaoSieuTocConfig> {
  await ensureTheCaoSieuTocSettings();
  const settings = await getLegacySettingsMap(forceRefresh);
  const baseUrl = settingValue(settings, 'thecaosieutoc_base_url', 'THECAOSIEUTOC_BASE_URL', 'https://thecaosieutoc.vn')
    .replace(/\/+$/, '');
  const partnerId = settingValue(settings, 'thecaosieutoc_partner_id', 'THECAOSIEUTOC_PARTNER_ID')
    || String(process.env.THECAOSIEUTOC_EXCHANGE_POST_PARTNER_ID || '').trim();
  const partnerKey = settingValue(settings, 'thecaosieutoc_partner_key', 'THECAOSIEUTOC_PARTNER_KEY')
    || String(process.env.THECAOSIEUTOC_EXCHANGE_POST_PARTNER_KEY || '').trim();
  const autoSubmit = normalizeBoolean(
    settingValue(settings, 'thecaosieutoc_auto_submit', 'THECAOSIEUTOC_AUTO_SUBMIT', '1'),
    true
  );
  const buyToken = settingValue(settings, 'thecaosieutoc_buy_token', 'THECAOSIEUTOC_CARD_BUY_TOKEN')
    || String(process.env.THECAOSIEUTOC_BUY_POST_TOKEN || '').trim()
    || String(process.env.THECAOSIEUTOC_BUY_TOKEN || '').trim()
    || String(process.env.THECAOSIEUTOC_BUY_POST_PARTNER_KEY || '').trim();
  const buyAutoSubmit = normalizeBoolean(
    settingValue(settings, 'thecaosieutoc_buy_auto_submit', 'THECAOSIEUTOC_BUY_AUTO_SUBMIT', '1'),
    true
  );

  return {
    baseUrl: baseUrl || 'https://thecaosieutoc.vn',
    partnerId,
    partnerKey,
    autoSubmit,
    configured: Boolean(partnerId && partnerKey),
    buyToken,
    buyAutoSubmit,
    buyConfigured: Boolean(buyToken),
  };
}

export function invalidateTheCaoSieuTocSettingsCache() {
  invalidateLegacySettingsCache();
}

export function normalizeTheCaoSieuTocTelco(value: unknown) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const map: Record<string, string> = {
    viettel: 'VIETTEL',
    mobifone: 'MOBIFONE',
    mobi: 'MOBIFONE',
    vinaphone: 'VINAPHONE',
    vina: 'VINAPHONE',
    vietnamobile: 'VIETNAMOBILE',
    vietnammobile: 'VIETNAMOBILE',
  };
  return map[normalized] || String(value || '').trim().toUpperCase();
}

export function createTheCaoSieuTocSign(partnerKey: string, code: string, serial: string) {
  return createHash('md5').update(`${partnerKey}${code}${serial}`).digest('hex');
}

export function getTheCaoSieuTocStatusCode(value: unknown) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseJsonMaybe(text: string) {
  try {
    return JSON.parse(text) as CardPayload;
  } catch {
    return { raw: text };
  }
}

function asRecord(value: unknown): CardPayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as CardPayload : {};
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function cardArrayFromPayload(payload: CardPayload) {
  const data = asRecord(payload.data);
  const candidates = [payload.cards, data.cards, payload.card, data.card, payload.result, data.result];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') return [candidate];
  }
  if (payload.code || payload.serial) return [payload];
  return [];
}

export function extractTheCaoSieuTocPurchasedCards(payload: CardPayload): TheCaoSieuTocPurchasedCard[] {
  return cardArrayFromPayload(payload)
    .map((item) => {
      const record = asRecord(item);
      const code = stringValue(record.code || record.pin || record.card_code);
      const serial = stringValue(record.serial || record.seri || record.card_serial);
      if (!code && !serial) return null;
      return {
        type: stringValue(record.type || record.type_card || record.telco),
        amount: Math.round(toNumber(record.amount || record.value || record.card_amount, 0)),
        code,
        serial,
      };
    })
    .filter((card): card is TheCaoSieuTocPurchasedCard => Boolean(card));
}

export async function submitTheCaoSieuTocCard(input: {
  telco: string;
  amount: number;
  serial: string;
  code: string;
  requestId: string;
}) {
  const config = await getTheCaoSieuTocCardConfig(true);
  if (!config.configured) {
    throw new Error('Chưa cấu hình Partner ID/Key cho API thẻ.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const body = {
    command: 'charging',
    partner_id: config.partnerId,
    sign: createTheCaoSieuTocSign(config.partnerKey, input.code, input.serial),
    telco: normalizeTheCaoSieuTocTelco(input.telco),
    code: input.code,
    serial: input.serial,
    amount: Math.trunc(input.amount),
    request_id: input.requestId,
  };

  try {
    const res = await fetch(`${config.baseUrl}/chargingws/v2`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    const payload = parseJsonMaybe(text);
    return {
      ok: res.ok,
      httpStatus: res.status,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function buyTheCaoSieuTocCard(input: {
  telco: string;
  amount: number;
  quantity?: number;
}) {
  const config = await getTheCaoSieuTocCardConfig(true);
  if (!config.buyConfigured) {
    throw new Error('Chưa cấu hình token mua thẻ.');
  }
  if (!config.buyAutoSubmit) {
    throw new Error('Chưa bật tự động mua thẻ.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const body = {
    token: config.buyToken,
    type_card: normalizeTheCaoSieuTocTelco(input.telco),
    amount: Math.trunc(input.amount),
    quantity: Math.max(1, Math.min(50, Math.trunc(Number(input.quantity || 1)) || 1)),
  };

  try {
    const res = await fetch(`${config.baseUrl}/api/card/buy`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    const payload = parseJsonMaybe(text);
    return {
      ok: res.ok,
      httpStatus: res.status,
      payload,
      cards: extractTheCaoSieuTocPurchasedCards(payload),
      orderCode: stringValue(payload.order_code || payload.order_id || payload.trans_id),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function payloadString(payload: CardPayload, key: string) {
  const value = payload[key];
  return value === null || value === undefined ? '' : String(value).trim();
}

function compactNote(prefix: string, payload: CardPayload) {
  const note = JSON.stringify({
    message: prefix,
    response: payload,
    synced_at: new Date().toISOString(),
  });
  return note.length > 60_000 ? note.slice(0, 60_000) : note;
}

function isCreditStatus(statusCode: number | null) {
  return statusCode === 1 || statusCode === 2;
}

function isFailedStatus(statusCode: number | null) {
  return statusCode === 3 || (statusCode !== null && statusCode >= 100);
}

export async function settleTheCaoSieuTocCardOrder(payload: CardPayload, options: { verifySignature?: boolean } = {}) {
  const requestId = payloadString(payload, 'request_id');
  if (!requestId) {
    throw new Error('Callback thiếu request_id.');
  }

  const config = await getTheCaoSieuTocCardConfig(true);
  const callbackSign = payloadString(payload, 'callback_sign');
  if (options.verifySignature) {
    const expectedSign = createTheCaoSieuTocSign(
      config.partnerKey,
      payloadString(payload, 'code'),
      payloadString(payload, 'serial')
    );
    if (!callbackSign || callbackSign.toLowerCase() !== expectedSign.toLowerCase()) {
      throw new Error('Chữ ký callback không hợp lệ.');
    }
  }

  const statusCode = getTheCaoSieuTocStatusCode(payload.status);
  const providerMessage = payloadString(payload, 'message') || 'Cập nhật trạng thái thẻ';

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT * FROM card_orders WHERE api_order_id = ? LIMIT 1 FOR UPDATE',
      requestId
    );
    const order = rows[0];
    if (!order) {
      return { state: 'not_found', request_id: requestId };
    }

    const orderId = Number(order.id || 0);
    const userId = Number(order.user_id || 0);
    const currentStatus = String(order.status || '').trim().toLowerCase();
    if (['success', 'refunded'].includes(currentStatus)) {
      return { state: 'already_processed', order_id: orderId, request_id: requestId };
    }

    if (statusCode === 99 || statusCode === null) {
      await tx.$executeRawUnsafe(
        'UPDATE card_orders SET status = ?, note = ?, updated_at = NOW() WHERE id = ?',
        'pending',
        compactNote(providerMessage, payload),
        orderId
      );
      return { state: 'pending', order_id: orderId, request_id: requestId };
    }

    if (isFailedStatus(statusCode)) {
      await tx.$executeRawUnsafe(
        'UPDATE card_orders SET status = ?, amount = ?, note = ?, updated_at = NOW() WHERE id = ?',
        'failed',
        0,
        compactNote(providerMessage, payload),
        orderId
      );
      return { state: 'failed', order_id: orderId, request_id: requestId, status: statusCode };
    }

    if (!isCreditStatus(statusCode)) {
      await tx.$executeRawUnsafe(
        'UPDATE card_orders SET status = ?, note = ?, updated_at = NOW() WHERE id = ?',
        'pending',
        compactNote(providerMessage, payload),
        orderId
      );
      return { state: 'pending', order_id: orderId, request_id: requestId, status: statusCode };
    }

    const creditAmount = Math.max(0, Math.round(toNumber(payload.amount, 0)));
    if (creditAmount <= 0) {
      await tx.$executeRawUnsafe(
        'UPDATE card_orders SET status = ?, amount = ?, note = ?, updated_at = NOW() WHERE id = ?',
        'failed',
        0,
        compactNote(providerMessage || 'Mệnh giá xử lý không hợp lệ', payload),
        orderId
      );
      return { state: 'failed', order_id: orderId, request_id: requestId, status: statusCode };
    }

    const user = await tx.users.findUnique({ where: { id: userId }, select: { balance: true } });
    if (!user) {
      throw new Error('Không tìm thấy tài khoản nhận tiền.');
    }

    const nextBalance = toNumber(user.balance, 0) + creditAmount;
    await tx.users.update({
      where: { id: userId },
      data: {
        balance: nextBalance,
        last_activity: new Date(),
      },
    });

    const actualCardValue = Math.max(0, Math.round(toNumber(payload.value, 0)));
    await tx.$executeRawUnsafe(
      `
        UPDATE card_orders
        SET status = ?, amount = ?, card_amount = ?, note = ?, updated_at = NOW()
        WHERE id = ?
      `,
      'success',
      creditAmount,
      actualCardValue || Number(order.card_amount || 0),
      compactNote(providerMessage || 'Thẻ xử lý thành công', payload),
      orderId
    );

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: creditAmount,
        balance_after: nextBalance,
        wallet_type: 'main',
        type: 'deposit',
        status: 'success',
        content: `Cộng tiền đổi thẻ #${orderId}`,
      },
    });

    return {
      state: 'processed',
      order_id: orderId,
      request_id: requestId,
      amount: creditAmount,
      balance_after: nextBalance,
      status: statusCode,
    };
  });
}
