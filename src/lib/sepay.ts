import 'server-only';

import crypto from 'node:crypto';
import { getLegacyEnv } from '@/lib/legacy-env';

const SIGNATURE_FIELD_ORDER = [
  'merchant',
  'operation',
  'payment_method',
  'order_amount',
  'currency',
  'order_invoice_number',
  'order_description',
  'customer_id',
  'success_url',
  'error_url',
  'cancel_url',
] as const;

interface BuildSePayCheckoutInput {
  amount: number;
  customerId?: string;
  description: string;
  orderId: string;
  origin?: string;
  paymentMethod?: 'BANK_TRANSFER' | 'CARD';
  wallet?: 'main' | 'game';
}

type SePayFields = Record<string, string>;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeSePayCallbackUrl(
  override: string,
  callbackBase: string,
  fallbackPath: string,
  legacyPaths: string[] = []
) {
  const fallbackUrl = new URL(fallbackPath, callbackBase).toString();
  const raw = override.trim();

  if (!raw) {
    return fallbackUrl;
  }

  try {
    const resolved = new URL(raw, callbackBase);
    if (legacyPaths.includes(resolved.pathname)) {
      return new URL(fallbackPath, resolved.origin).toString();
    }

    return resolved.toString();
  } catch {
    return fallbackUrl;
  }
}

function resolveCallbackBase(origin?: string) {
  const preferredOrigin =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    origin?.trim() ||
    getLegacyEnv('API_DOMAIN', 'https://trungtammmo.vn');

  return trimTrailingSlash(preferredOrigin);
}

export function getSePayConfig(origin?: string) {
  const wallet = origin === '__game__' ? 'game' : 'main';
  const prefix = wallet === 'game' ? 'GAME_SEPAY_' : 'SEPAY_';
  const callbackOrigin = wallet === 'game' ? undefined : origin;
  const getConfigValue = (key: string, fallback = '', allowDefaultFallback = true) => {
    const direct = getLegacyEnv(`${prefix}${key}`);
    if (direct) return direct;
    if (!allowDefaultFallback) return fallback;
    return wallet === 'game' ? getLegacyEnv(`SEPAY_${key}`, fallback) : getLegacyEnv(`SEPAY_${key}`, fallback);
  };
  const mode = getConfigValue('MODE', 'production').toLowerCase();
  const callbackBase = resolveCallbackBase(callbackOrigin);
  const configuredIpnUrl = getConfigValue('IPN_URL', '', wallet !== 'game');
  const configuredSuccessUrl = getConfigValue('SUCCESS_URL', '', wallet !== 'game');
  const configuredErrorUrl = getConfigValue('ERROR_URL', '', wallet !== 'game');
  const configuredCancelUrl = getConfigValue('CANCEL_URL', '', wallet !== 'game');
  const depositQuery = wallet === 'game' ? '?wallet=game&payment=' : '?payment=';

  return {
    mode,
    wallet,
    merchantId: getConfigValue('MERCHANT_ID'),
    secretKey: getConfigValue('SECRET_KEY'),
    apiToken: getConfigValue('API_TOKEN') || getConfigValue('API_KEY'),
    webhookToken: getConfigValue('WEBHOOK_TOKEN'),
    userApiUrl: getConfigValue('USER_API_URL', 'https://my.sepay.vn/userapi'),
    gatewayApiUrl: getConfigValue(
      'GATEWAY_API_URL',
      mode === 'production'
        ? 'https://pgapi.sepay.vn/v1'
        : 'https://pgapi-sandbox.sepay.vn/v1'
    ),
    checkoutUrl:
      mode === 'production'
        ? 'https://pay.sepay.vn/v1/checkout/init'
        : 'https://pay-sandbox.sepay.vn/v1/checkout/init',
    ipnUrl: normalizeSePayCallbackUrl(
      configuredIpnUrl,
      callbackBase,
      '/payment/sepay/ipn'
    ),
    successUrl: normalizeSePayCallbackUrl(
      configuredSuccessUrl,
      callbackBase,
      `/user/deposit${depositQuery}success`,
      ['/deposit']
    ),
    errorUrl: normalizeSePayCallbackUrl(
      configuredErrorUrl,
      callbackBase,
      `/user/deposit${depositQuery}error`,
      ['/deposit']
    ),
    cancelUrl: normalizeSePayCallbackUrl(
      configuredCancelUrl,
      callbackBase,
      `/user/deposit${depositQuery}cancel`,
      ['/deposit']
    ),
  };
}

export function generateSePaySignature(fields: SePayFields, secretKey: string) {
  const signed = SIGNATURE_FIELD_ORDER.flatMap((fieldName) => {
    const value = fields[fieldName];
    return typeof value === 'string' ? [`${fieldName}=${value}`] : [];
  });

  return crypto.createHmac('sha256', secretKey).update(signed.join(',')).digest('base64');
}

export function buildSePayCheckout(input: BuildSePayCheckoutInput) {
  const config = input.wallet === 'game' ? getSePayConfig('__game__') : getSePayConfig(input.origin);

  if (!config.merchantId || !config.secretKey) {
    return {
      success: false as const,
      message: 'Thiếu cấu hình SePay merchant_id hoặc secret_key',
    };
  }

  const fields: SePayFields = {
    merchant: config.merchantId,
    currency: 'VND',
    order_amount: String(Math.trunc(input.amount)),
    operation: 'PURCHASE',
    order_description: input.description,
    order_invoice_number: input.orderId,
    customer_id: input.customerId || '',
    success_url: config.successUrl,
    error_url: config.errorUrl,
    cancel_url: config.cancelUrl,
  };

  if (input.paymentMethod) {
    fields.payment_method = input.paymentMethod;
  }

  fields.signature = generateSePaySignature(fields, config.secretKey);

  return {
    success: true as const,
    checkoutUrl: config.checkoutUrl,
    config,
    fields,
  };
}

export async function createSePayCheckoutSession(input: BuildSePayCheckoutInput) {
  const checkout = buildSePayCheckout(input);
  if (!checkout.success) {
    return checkout;
  }

  const response = await fetch(checkout.checkoutUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(checkout.fields),
    redirect: 'manual',
    cache: 'no-store',
  });

  const redirectUrl = response.headers.get('location') || '';
  if (!redirectUrl) {
    const bodyPreview = (await response.text().catch(() => '')).slice(0, 500);
    return {
      success: false as const,
      message: `SePay checkout không trả về redirect URL (HTTP ${response.status})${bodyPreview ? `: ${bodyPreview}` : ''}`,
    };
  }

  const redirect = new URL(redirectUrl);
  const sepayOrderId = String(redirect.searchParams.get('order_id') || '').trim();

  return {
    success: true as const,
    checkoutUrl: checkout.checkoutUrl,
    redirectUrl,
    sepayOrderId,
    config: checkout.config,
    fields: checkout.fields,
  };
}

export function verifySePayIpn(headers: Headers, payload: Record<string, unknown>) {
  const configs = [getSePayConfig(), getSePayConfig('__game__')];
  const authorizationHeader = headers.get('authorization') || headers.get('Authorization') || '';
  const authorizationToken = authorizationHeader
    .replace(/^apikey\s+/i, '')
    .replace(/^bearer\s+/i, '')
    .trim();
  const receivedSecrets = [
    headers.get('x-secret-key') ||
    '',
    headers.get('X-Secret-Key') || '',
    headers.get('x_secret_key') || '',
    authorizationToken,
  ].filter(Boolean);

  const validSecrets = [
    ...configs.flatMap((config) => [config.webhookToken, config.secretKey]),
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (!validSecrets.length) {
    return {
      success: false as const,
      message: 'Chưa cấu hình SEPAY_WEBHOOK_TOKEN / SEPAY_SECRET_KEY',
    };
  }

  const matched = validSecrets.some((secret) => {
    const expectedBuffer = Buffer.from(secret);
    return receivedSecrets.some((candidate) => {
      const receivedBuffer = Buffer.from(candidate);
      return (
        expectedBuffer.length === receivedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
      );
    });
  });

  if (!matched) {
    return {
      success: false as const,
      message: 'SePay authorization không hợp lệ',
    };
  }

  return {
    success: true as const,
  };
}
