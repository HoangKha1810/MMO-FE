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
  const mode = getLegacyEnv('SEPAY_MODE', 'production').toLowerCase();
  const callbackBase = resolveCallbackBase(origin);
  const configuredIpnUrl = getLegacyEnv('SEPAY_IPN_URL');
  const configuredSuccessUrl = getLegacyEnv('SEPAY_SUCCESS_URL');
  const configuredErrorUrl = getLegacyEnv('SEPAY_ERROR_URL');
  const configuredCancelUrl = getLegacyEnv('SEPAY_CANCEL_URL');

  return {
    mode,
    merchantId: getLegacyEnv('SEPAY_MERCHANT_ID'),
    secretKey: getLegacyEnv('SEPAY_SECRET_KEY'),
    apiKey: getLegacyEnv('SEPAY_API_KEY'),
    webhookToken: getLegacyEnv('SEPAY_WEBHOOK_TOKEN'),
    userApiUrl: getLegacyEnv('SEPAY_USER_API_URL', 'https://my.sepay.vn/userapi'),
    gatewayApiUrl: getLegacyEnv(
      'SEPAY_GATEWAY_API_URL',
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
      '/api/payment/sepay/ipn',
      ['/payment/sepay/ipn', '/sepay/ipn']
    ),
    successUrl: normalizeSePayCallbackUrl(
      configuredSuccessUrl,
      callbackBase,
      '/user/deposit?payment=success',
      ['/deposit']
    ),
    errorUrl: normalizeSePayCallbackUrl(
      configuredErrorUrl,
      callbackBase,
      '/user/deposit?payment=error',
      ['/deposit']
    ),
    cancelUrl: normalizeSePayCallbackUrl(
      configuredCancelUrl,
      callbackBase,
      '/user/deposit?payment=cancel',
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
  const config = getSePayConfig(input.origin);

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

export function verifySePayIpn(headers: Headers, payload: Record<string, unknown>) {
  const config = getSePayConfig();
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
    config.apiKey,
    config.webhookToken,
    config.secretKey,
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (!validSecrets.length) {
    return {
      success: false as const,
      message: 'Chưa cấu hình SEPAY_API_KEY / SEPAY_WEBHOOK_TOKEN / SEPAY_SECRET_KEY',
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
