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

  return {
    mode,
    merchantId: getLegacyEnv('SEPAY_MERCHANT_ID'),
    secretKey: getLegacyEnv('SEPAY_SECRET_KEY'),
    checkoutUrl:
      mode === 'production'
        ? 'https://pay.sepay.vn/v1/checkout/init'
        : 'https://pay-sandbox.sepay.vn/v1/checkout/init',
    ipnUrl: getLegacyEnv('SEPAY_IPN_URL', `${callbackBase}/api/payment/sepay/ipn`),
    successUrl: getLegacyEnv('SEPAY_SUCCESS_URL', `${callbackBase}/user/deposit?payment=success`),
    errorUrl: getLegacyEnv('SEPAY_ERROR_URL', `${callbackBase}/user/deposit?payment=error`),
    cancelUrl: getLegacyEnv('SEPAY_CANCEL_URL', `${callbackBase}/user/deposit?payment=cancel`),
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
  const secretKey = getLegacyEnv('SEPAY_SECRET_KEY');
  const receivedSecret =
    headers.get('x-secret-key') ||
    headers.get('X-Secret-Key') ||
    headers.get('x_secret_key') ||
    '';

  if (!secretKey) {
    return {
      success: false as const,
      message: 'Chưa cấu hình SEPAY_SECRET_KEY',
    };
  }

  const expectedBuffer = Buffer.from(secretKey);
  const receivedBuffer = Buffer.from(receivedSecret);

  if (
    !receivedSecret ||
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return {
      success: false as const,
      message: 'X-Secret-Key không hợp lệ',
    };
  }

  if (typeof payload.notification_type !== 'string') {
    return {
      success: false as const,
      message: 'Thiếu notification_type',
    };
  }

  return {
    success: true as const,
  };
}
