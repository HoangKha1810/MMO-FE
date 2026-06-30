import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import bcrypt from 'bcryptjs';
import {
  buildLienQuanExportText,
  filterLienQuanAccounts,
  LIEN_QUAN_FILTER_FEE,
  LIEN_QUAN_FILTER_PREVIEW_LIMIT,
  maskLienQuanSensitiveRow,
  parseLienQuanAccountText,
  summarizeLienQuanRows,
  type LienQuanAccountFilters,
} from '@/lib/lien-quan-account-filter';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.ceil(value)))}đ`;
}

async function getUserId() {
  return getVerifiedSessionUserId();
}

function normalizeFilters(value: unknown): LienQuanAccountFilters {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const input = value as Record<string, unknown>;
  return {
    search: String(input.search || '').slice(0, 120),
    vipMin: Number(input.vipMin || 0),
    vipMax: Number(input.vipMax || 0),
    skinMin: Number(input.skinMin || 0),
    skinMax: Number(input.skinMax || 0),
    ssMin: Number(input.ssMin || 0),
    statuses: Array.isArray(input.statuses)
      ? input.statuses.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    requireCccd: Boolean(input.requireCccd),
    requireVerifiedEmail: Boolean(input.requireVerifiedEmail),
    requireRareSkin: Boolean(input.requireRareSkin),
  };
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null) as
      | { action?: unknown; text?: unknown; filters?: unknown; password?: unknown }
      | null;
    const text = String(body?.text || '').trim();
    const action = String(body?.action || 'filter');

    if (!text) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng upload file .txt hoặc dán nội dung acc cần lọc.' },
        { status: 400 },
      );
    }

    if (text.length > 2_000_000) {
      return NextResponse.json(
        { success: false, message: 'File quá lớn. Vui lòng chia nhỏ dưới 2MB mỗi lần lọc.' },
        { status: 400 },
      );
    }

    const allRows = parseLienQuanAccountText(text);
    if (allRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Không đọc được acc Liên Quân từ nội dung đã gửi.' },
        { status: 400 },
      );
    }

    const filters = normalizeFilters(body?.filters);
    const filteredRows = filterLienQuanAccounts(allRows, filters);
    const summaries = {
      input: summarizeLienQuanRows(allRows),
      filtered: summarizeLienQuanRows(filteredRows),
    };

    if (action === 'unlock') {
      const password = String(body?.password || '');
      if (!password) {
        return NextResponse.json(
          { success: false, message: 'Vui lòng nhập mật khẩu tài khoản để xem full acc.' },
          { status: 400 },
        );
      }

      const user = await db.users.findUnique({
        where: { id: userId },
        select: { password: true, status: true },
      });

      if (!user || user.status !== 'active') {
        return NextResponse.json(
          { success: false, message: 'Tài khoản không hợp lệ hoặc đã bị khóa.' },
          { status: 403 },
        );
      }

      const passwordOk = await bcrypt.compare(password, user.password);
      if (!passwordOk) {
        return NextResponse.json(
          { success: false, message: 'Mật khẩu không đúng.' },
          { status: 401 },
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Đã mở khóa full acc trong phiên hiện tại.',
        total: allRows.length,
        filtered: filteredRows.length,
        summaries,
        rows: filteredRows.slice(0, LIEN_QUAN_FILTER_PREVIEW_LIMIT),
        previewLimit: LIEN_QUAN_FILTER_PREVIEW_LIMIT,
        exportText: buildLienQuanExportText(filteredRows),
        unlocked: true,
      });
    }

    const billing = await db.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { game_balance: true },
      });

      if (!user) {
        throw new Error('Không tìm thấy người dùng.');
      }

      const currentBalance = toNumber(user.game_balance, 0);
      const nextBalance = currentBalance - LIEN_QUAN_FILTER_FEE;
      if (nextBalance < 0) {
        throw new Error(
          `Ví game không đủ. Vui lòng nạp thêm ${formatVnd(Math.abs(nextBalance))} để dùng bộ lọc acc Liên Quân.`,
        );
      }

      await tx.users.update({
        where: { id: userId },
        data: { game_balance: nextBalance, last_activity: new Date() },
      });

      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: LIEN_QUAN_FILTER_FEE,
          balance_after: nextBalance,
          wallet_type: 'game',
          type: 'order',
          status: 'success',
          content: `Lọc acc Liên Quân tự động: ${allRows.length} dòng, còn ${filteredRows.length} dòng`,
        },
      }).catch(() => undefined);

      return {
        fee: LIEN_QUAN_FILTER_FEE,
        game_balance: nextBalance,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Đã lọc ${filteredRows.length}/${allRows.length} acc Liên Quân và trừ ${formatVnd(LIEN_QUAN_FILTER_FEE)} ví game.`,
      fee: billing.fee,
      game_balance: billing.game_balance,
      total: allRows.length,
      filtered: filteredRows.length,
      summaries,
      rows: filteredRows.slice(0, LIEN_QUAN_FILTER_PREVIEW_LIMIT).map(maskLienQuanSensitiveRow),
      previewLimit: LIEN_QUAN_FILTER_PREVIEW_LIMIT,
      exportText: '',
      unlocked: false,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể lọc acc Liên Quân.' },
      { status: 400 },
    );
  }
}
