import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { isUploadFileLike } from '@/lib/server-upload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const avatarExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getSafeExtension(file: File) {
  const ext = path.extname(file.name || '').replace('.', '').toLowerCase();
  return ext.replace(/[^a-z0-9]/g, '');
}

async function saveAvatarFile(file: File, userId: number) {
  const ext = getSafeExtension(file);

  if (!ext || !avatarExtensions.has(ext)) {
    throw new Error('Ảnh avatar không hợp lệ. Chỉ hỗ trợ JPG, PNG, WEBP hoặc GIF.');
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error('Avatar quá lớn. Giới hạn tối đa 5MB.');
  }

  const filename = `avatar_${userId}_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
  const relativeDir = path.posix.join('uploads', 'avatars');
  const targetDir = path.join(process.cwd(), 'public', relativeDir);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, filename), Buffer.from(await file.arrayBuffer()));

  return path.posix.join(relativeDir, filename);
}

function parseBirthday(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Ngày sinh không hợp lệ.');
  }

  return parsed;
}

export async function PATCH(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const avatarFile = formData.get('avatar');
    const removeAvatar = getFormString(formData, 'remove_avatar') === '1';

    const fullname = getFormString(formData, 'fullname').slice(0, 100);
    const bio = getFormString(formData, 'bio').slice(0, 3000);
    const occupation = getFormString(formData, 'occupation').slice(0, 100);
    const hometown = getFormString(formData, 'hometown').slice(0, 100);
    const contact = getFormString(formData, 'contact').slice(0, 100);
    const telegramUsername = getFormString(formData, 'telegram_username').replace(/^@+/, '').slice(0, 255);
    const expertiseTags = getFormString(formData, 'expertise_tags').slice(0, 3000);
    const gender = getFormString(formData, 'gender').slice(0, 20);
    const birthday = parseBirthday(getFormString(formData, 'birthday'));

    let nextAvatarPath: string | null | undefined;
    if (removeAvatar) {
      nextAvatarPath = null;
    } else if (isUploadFileLike(avatarFile)) {
      nextAvatarPath = await saveAvatarFile(avatarFile, userId);
    }

    const updatedUser = await db.users.update({
      where: { id: userId },
      data: {
        fullname: fullname || null,
        bio: bio || null,
        occupation: occupation || null,
        hometown: hometown || null,
        contact: contact || null,
        telegram_username: telegramUsername || null,
        expertise_tags: expertiseTags || null,
        gender: gender || null,
        birthday,
        ...(typeof nextAvatarPath !== 'undefined' ? { avatar: nextAvatarPath } : {}),
      },
      select: {
        id: true,
        username: true,
        fullname: true,
        email: true,
        avatar: true,
        rank: true,
        bio: true,
        occupation: true,
        hometown: true,
        contact: true,
        telegram_username: true,
        expertise_tags: true,
        birthday: true,
        gender: true,
      },
    });

    await db.activity_logs.create({
      data: {
        user_id: userId,
        activity: 'Cập nhật thông tin cá nhân và avatar hồ sơ',
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null,
        user_agent: req.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Đã cập nhật hồ sơ thành công.',
      user: {
        ...updatedUser,
        avatar: buildLegacyAssetUrl(updatedUser.avatar) || undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ',
      },
      { status: 400 }
    );
  }
}
