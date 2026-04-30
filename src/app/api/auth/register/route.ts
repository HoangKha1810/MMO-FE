import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import {
  MAX_ACCOUNTS_PER_IP,
  autoBanRegistrationIp,
  buildBlockedIpPayload,
  countAccountsByIp,
  getIpBlock,
  getRequestIp,
  isTrackableIp,
  logSecurityEvent,
} from '@/lib/ip-security';

function validateUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.@-]{3,50}$/.test(username);
}

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    const blockedIp = await getIpBlock(ip);
    if (blockedIp) {
      await logSecurityEvent({
        eventType: 'REGISTER_BLOCKED_IP',
        severity: 'HIGH',
        ip,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'ip',
        payload: String(blockedIp.reason || 'blocked'),
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json(
        buildBlockedIpPayload(ip, blockedIp.reason),
        { status: 403 }
      );
    }

    const accountCount = await countAccountsByIp(ip);
    if (isTrackableIp(ip) && accountCount >= MAX_ACCOUNTS_PER_IP) {
      await autoBanRegistrationIp(ip, accountCount, req);
      return NextResponse.json(
        buildBlockedIpPayload(
          ip,
          `IP này đã tạo ${accountCount} tài khoản. Hệ thống đã khóa IP, vui lòng liên hệ admin để mở khóa.`
        ),
        { status: 403 }
      );
    }

    const { username, email, password, fullname } = await req.json();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedUsername || !normalizedEmail || !password) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng nhập đầy đủ thông tin bắt buộc' },
        { status: 400 }
      );
    }

    if (!validateUsername(normalizedUsername)) {
      return NextResponse.json(
        { success: false, message: 'Tên đăng nhập không hợp lệ (3-50 ký tự, chỉ chứa a-z, 0-9, _, ., @, -)' },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, message: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    const existing = await db.users.findFirst({
      where: {
        OR: [
          { username: normalizedUsername },
          { email: normalizedEmail },
        ],
      },
      select: {
        username: true,
        email: true,
      },
    });

    if (existing) {
      if (existing.username.toLowerCase() === normalizedUsername) {
        return NextResponse.json(
          { success: false, message: 'Tên đăng nhập đã được sử dụng' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, message: 'Email đã được sử dụng' },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(String(password), 10);

    const user = await db.users.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashed,
        fullname: String(fullname || normalizedUsername).trim(),
        role: 'member',
        status: 'active',
        balance: 0,
        rank: 'Member',
        last_ip: isTrackableIp(ip) ? ip : null,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    await db.activity_logs.create({
      data: {
        user_id: user.id,
        activity: `Đăng ký tài khoản từ IP ${ip}`,
        ip_address: isTrackableIp(ip) ? ip : undefined,
        user_agent: req.headers.get('user-agent') || undefined,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: 'Đăng ký thành công',
      user,
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
