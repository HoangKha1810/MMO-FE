import 'server-only';

import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

function normalizeClientHint(value: string | null) {
  return String(value || '')
    .replace(/^"+|"+$/g, '')
    .trim();
}

function appSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.APP_KEY ||
    'development-only-device-secret'
  );
}

function hashValue(value: string) {
  return crypto.createHmac('sha256', appSecret()).update(value).digest('hex');
}

function detectBrowser(userAgent: string) {
  const ua = userAgent || '';
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/SamsungBrowser\//i.test(ua)) return 'Samsung Internet';
  if (/CriOS\//i.test(ua)) return 'Chrome iOS';
  if (/Chrome\//i.test(ua)) return 'Google Chrome';
  if (/FxiOS\//i.test(ua)) return 'Firefox iOS';
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox';
  if (/Version\/[\d.]+.*Safari\//i.test(ua)) return 'Safari';
  if (/Safari\//i.test(ua)) return 'Safari';
  if (/PostmanRuntime/i.test(ua)) return 'Postman';
  if (/curl/i.test(ua)) return 'curl';
  if (/python-requests/i.test(ua)) return 'Python Requests';
  return 'Không xác định';
}

function detectOs(userAgent: string, platformHint: string) {
  const hint = normalizeClientHint(platformHint);
  const ua = userAgent || '';

  if (hint && !/^unknown$/i.test(hint)) {
    if (/mac/i.test(hint)) return 'macOS';
    if (/windows/i.test(hint)) return 'Windows';
    if (/android/i.test(hint)) return 'Android';
    if (/ios|iphone|ipad/i.test(hint)) return 'iOS';
    if (/linux/i.test(hint)) return 'Linux';
    return hint;
  }

  if (/Windows NT 10/i.test(ua)) return 'Windows 10/11';
  if (/Windows NT 6\.3/i.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6\.2/i.test(ua)) return 'Windows 8';
  if (/Windows NT 6\.1/i.test(ua)) return 'Windows 7';
  if (/Mac OS X/i.test(ua) && /Mobile/i.test(ua)) return 'iOS';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Không xác định';
}

function detectDeviceType(userAgent: string, mobileHint: string | null) {
  const ua = userAgent || '';
  const hint = normalizeClientHint(mobileHint);
  if (hint === '?1') return 'Mobile';
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'Tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

function buildDeviceName(os: string, browser: string, deviceType: string) {
  if (deviceType === 'Mobile' && os === 'iOS') return `iPhone/iOS - ${browser}`;
  if (deviceType === 'Tablet' && os === 'iOS') return `iPad/iOS - ${browser}`;
  if (deviceType === 'Mobile' && os === 'Android') return `Android Phone - ${browser}`;
  if (deviceType === 'Tablet' && os === 'Android') return `Android Tablet - ${browser}`;
  if (/macOS/i.test(os)) return `Mac - ${browser}`;
  if (/Windows/i.test(os)) return `Windows PC - ${browser}`;
  if (/Linux/i.test(os)) return `Linux PC - ${browser}`;
  return `${deviceType} - ${browser}`;
}

export function getRequestDeviceInfo(req: NextRequest) {
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const acceptLanguage = req.headers.get('accept-language') || '';
  const platformHint = req.headers.get('sec-ch-ua-platform') || '';
  const mobileHint = req.headers.get('sec-ch-ua-mobile');
  const browser = detectBrowser(userAgent);
  const os = detectOs(userAgent, platformHint);
  const deviceType = detectDeviceType(userAgent, mobileHint);
  const deviceName = buildDeviceName(os, browser, deviceType);
  const deviceHash = hashValue([userAgent, acceptLanguage, platformHint, mobileHint || ''].join('|')).slice(0, 64);

  return {
    deviceHash,
    deviceName,
    os,
    browser,
    deviceType,
    userAgent,
    acceptLanguage,
    platformHint: normalizeClientHint(platformHint),
    mobileHint: normalizeClientHint(mobileHint),
  };
}
