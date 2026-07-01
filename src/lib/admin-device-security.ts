import 'server-only';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getRequestDeviceInfo } from '@/lib/device-info';
import { getRequestIp } from '@/lib/ip-security';
import { sendSecurityAlertEmail } from '@/lib/security-alert-email';

type AdminDeviceUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  role?: string | null;
};

const ADMIN_DEVICE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS admin_trusted_devices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    device_hash VARCHAR(96) NOT NULL,
    device_name VARCHAR(190) NULL,
    os_name VARCHAR(120) NULL,
    browser_name VARCHAR(120) NULL,
    device_type VARCHAR(60) NULL,
    user_agent TEXT NULL,
    first_ip VARCHAR(45) NULL,
    last_ip VARCHAR(45) NULL,
    first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_admin_device (user_id, device_hash),
    KEY idx_admin_trusted_devices_user (user_id),
    KEY idx_admin_trusted_devices_ip (last_ip)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let tableReady = false;

async function ensureAdminDeviceTable() {
  if (tableReady) return;
  await db.$executeRawUnsafe(ADMIN_DEVICE_TABLE_SQL).catch(() => undefined);
  tableReady = true;
}

export async function recordAdminLoginDevice(req: NextRequest, user: AdminDeviceUser) {
  await ensureAdminDeviceTable();

  const ip = getRequestIp(req);
  const device = getRequestDeviceInfo(req);
  const existingRows = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>(
    `
      SELECT id
      FROM admin_trusted_devices
      WHERE user_id = ? AND device_hash = ?
      LIMIT 1
    `,
    user.id,
    device.deviceHash
  ).catch(() => []);
  const isNewDevice = existingRows.length === 0;

  await db.$executeRawUnsafe(
    `
      INSERT INTO admin_trusted_devices
        (user_id, device_hash, device_name, os_name, browser_name, device_type, user_agent, first_ip, last_ip, first_seen_at, last_seen_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        device_name = VALUES(device_name),
        os_name = VALUES(os_name),
        browser_name = VALUES(browser_name),
        device_type = VALUES(device_type),
        user_agent = VALUES(user_agent),
        last_ip = VALUES(last_ip),
        last_seen_at = NOW()
    `,
    user.id,
    device.deviceHash,
    device.deviceName,
    device.os,
    device.browser,
    device.deviceType,
    device.userAgent,
    ip,
    ip
  ).catch(() => undefined);

  if (isNewDevice) {
    await sendSecurityAlertEmail({
      event: 'ADMIN_NEW_DEVICE_LOGIN',
      title: 'Admin đăng nhập từ thiết bị mới',
      severity: String(user.role || '').toLowerCase() === 'owner' ? 'CRITICAL' : 'HIGH',
      ip,
      userId: user.id,
      username: user.username || null,
      email: user.email || null,
      reason: `Thiết bị mới: ${device.deviceName}; OS=${device.os}; Browser=${device.browser}`,
      path: req.nextUrl.pathname,
      method: req.method,
      userAgent: device.userAgent,
      details: {
        role: user.role || null,
        device_name: device.deviceName,
        os: device.os,
        browser: device.browser,
        device_type: device.deviceType,
        device_hash: device.deviceHash,
        accept_language: device.acceptLanguage,
        platform_hint: device.platformHint,
        mobile_hint: device.mobileHint,
      },
      cooldownKey: `admin-new-device:${user.id}:${device.deviceHash}`,
      force: true,
    }).catch(() => undefined);
  }

  await db.activity_logs.create({
    data: {
      user_id: user.id,
      activity: `${isNewDevice ? 'Thiết bị admin mới' : 'Thiết bị admin đã biết'} đăng nhập: ${device.deviceName} | ${device.os} | ${device.browser}`,
      ip_address: ip,
      user_agent: device.userAgent,
    },
  }).catch(() => undefined);

  return { isNewDevice, device, ip };
}
