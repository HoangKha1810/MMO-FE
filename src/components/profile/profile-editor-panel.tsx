'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eraser, ImagePlus, KeyRound, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditableProfile {
  username: string;
  email: string;
  fullname: string;
  avatar?: string;
  bio: string;
  occupation: string;
  hometown: string;
  contact: string;
  telegram_username: string;
  expertise_tags: string;
  birthday: string;
  gender: string;
}

interface ProfileEditorPanelProps {
  initialProfile: EditableProfile;
}

const textAreaClassName =
  'field-elevated min-h-[126px] w-full rounded-[1rem] px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/10 dark:text-white';

export function ProfileEditorPanel({ initialProfile }: ProfileEditorPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialProfile);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(initialProfile.avatar || '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setForm(initialProfile);
    setAvatarPreviewUrl(initialProfile.avatar || '');
    setAvatarFile(null);
    setRemoveAvatar(false);
  }, [initialProfile]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  function updateField<K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleAvatarChange(file: File | null) {
    if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    if (!file) {
      setAvatarFile(null);
      setAvatarPreviewUrl(removeAvatar ? '' : initialProfile.avatar || '');
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const payload = new FormData();
      payload.append('fullname', form.fullname);
      payload.append('bio', form.bio);
      payload.append('occupation', form.occupation);
      payload.append('hometown', form.hometown);
      payload.append('contact', form.contact);
      payload.append('telegram_username', form.telegram_username);
      payload.append('expertise_tags', form.expertise_tags);
      payload.append('birthday', form.birthday);
      payload.append('gender', form.gender);

      if (removeAvatar) {
        payload.append('remove_avatar', '1');
      }

      if (avatarFile) {
        payload.append('avatar', avatarFile);
      }

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        body: payload,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể cập nhật hồ sơ');
      }

      toast.success(result.message || 'Đã lưu hồ sơ');
      setAvatarFile(null);
      setRemoveAvatar(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordLoading(true);

    try {
      const response = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể đổi mật khẩu');
      }

      toast.success(result.message || 'Đã đổi mật khẩu');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đổi mật khẩu');
    } finally {
      setPasswordLoading(false);
    }
  }

  const avatarLabel = form.fullname || form.username;

  return (
    <section className="surface-panel rounded-[1.8rem] p-5 md:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-white/10 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Profile Studio</div>
          <h2 className="mt-2 text-2xl font-black uppercase leading-[1.08] tracking-[-0.028em] text-slate-950 dark:text-white">
            Tùy chỉnh hồ sơ cá nhân
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-[1.95] tracking-[0.02em] text-slate-600 dark:text-slate-300">
            Bạn có thể đổi avatar, cập nhật mô tả bản thân và các thông tin hiển thị trong hồ sơ. Sau khi lưu, shell và trang profile sẽ tự làm mới.
          </p>
        </div>
        <Badge variant="info" className="rounded-full px-3 py-1.5">
          <Sparkles className="h-3 w-3" />
          Live profile update
        </Badge>
      </div>

      <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[1.55rem] border border-slate-200/80 bg-white/75 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-32 w-32 rounded-[2rem] border border-slate-200/80 shadow-[0_24px_60px_-36px_rgba(37,99,235,0.38)] dark:border-white/10">
                <AvatarImage src={removeAvatar ? undefined : avatarPreviewUrl || undefined} className="object-cover" />
                <AvatarFallback className="rounded-[2rem] bg-gradient-to-br from-brand-blue via-sky-500 to-indigo-500 text-3xl font-black text-white">
                  {avatarLabel.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="mt-4 text-lg font-black uppercase tracking-[-0.028em] text-slate-950 dark:text-white">
                {form.fullname || form.username}
              </div>
              <div className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                @{form.username}
              </div>

              <div className="mt-5 flex w-full flex-col gap-3">
                <label className="group cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => handleAvatarChange(event.target.files?.[0] || null)}
                  />
                  <div className="btn-kinetic inline-flex w-full items-center justify-center gap-2 rounded-[1rem] border border-slate-200/80 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition-all group-hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                    <ImagePlus className="h-4 w-4" />
                    Chọn avatar mới
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setAvatarFile(null);
                    setRemoveAvatar(true);
                    if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
                      URL.revokeObjectURL(avatarPreviewUrl);
                    }
                    setAvatarPreviewUrl('');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-red-500 transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:text-white dark:border-red-500/20 dark:bg-red-500/[0.08] dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  <Eraser className="h-4 w-4" />
                  Xóa avatar
                </button>
              </div>

              <div className="mt-4 rounded-[1rem] border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-left dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Avatar note</div>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                  Hỗ trợ JPG, PNG, WEBP, GIF. Giới hạn tối đa 5MB. Avatar mới sẽ hiện ở shell sau khi lưu.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Username</div>
              <Input value={form.username} disabled />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Email</div>
              <Input value={form.email} disabled />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Họ tên</div>
              <Input value={form.fullname} onChange={(event) => updateField('fullname', event.target.value)} placeholder="Nhập họ tên hiển thị" />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Nghề nghiệp</div>
              <Input value={form.occupation} onChange={(event) => updateField('occupation', event.target.value)} placeholder="Ví dụ: Trader / Marketer" />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Quê quán</div>
              <Input value={form.hometown} onChange={(event) => updateField('hometown', event.target.value)} placeholder="Ví dụ: Hà Nội" />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Liên hệ</div>
              <Input value={form.contact} onChange={(event) => updateField('contact', event.target.value)} placeholder="Số điện thoại / Zalo / Facebook" />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Telegram</div>
              <Input value={form.telegram_username} onChange={(event) => updateField('telegram_username', event.target.value)} placeholder="telegram_username" />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ngày sinh</div>
              <Input type="date" value={form.birthday} onChange={(event) => updateField('birthday', event.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Giới tính</div>
              <select
                value={form.gender}
                onChange={(event) => updateField('gender', event.target.value)}
                className="field-elevated flex h-11 w-full rounded-[1rem] px-4 py-3 text-sm font-semibold text-slate-900 transition-all focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
              >
                <option value="">Chưa cập nhật</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Tags kỹ năng</div>
              <Input
                value={form.expertise_tags}
                onChange={(event) => updateField('expertise_tags', event.target.value)}
                placeholder="MMO, SMM, Forum, Auto MXH, Reseller..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Bio</div>
              <textarea
                value={form.bio}
                onChange={(event) => updateField('bio', event.target.value)}
                placeholder="Viết một đoạn giới thiệu ngắn về bạn..."
                className={textAreaClassName}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[1.55rem] border border-slate-200/80 bg-white/75 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="info" className="rounded-full px-3 py-1.5">
              <KeyRound className="h-3 w-3" />
              Bảo mật tài khoản
            </Badge>
            <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
              Đổi mật khẩu
            </div>
          </div>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Nhập mật khẩu hiện tại và mật khẩu mới. Hệ thống sẽ cập nhật trực tiếp vào tài khoản của bạn sau khi xác thực đúng mật khẩu cũ.
          </p>

          <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={handlePasswordSubmit}>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mật khẩu hiện tại</div>
              <Input
                type="password"
                value={passwordForm.current_password}
                onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                placeholder="Nhập mật khẩu hiện tại"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mật khẩu mới</div>
              <Input
                type="password"
                value={passwordForm.new_password}
                onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
                placeholder="Ít nhất 8 ký tự"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Xác nhận mật khẩu mới</div>
              <Input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
              />
            </div>

            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" loading={passwordLoading} loadingText="Đang đổi mật khẩu">
                <KeyRound className="h-4 w-4" />
                Đổi mật khẩu
              </Button>
            </div>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-5 dark:border-white/10">
          <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Sau khi lưu, hệ thống sẽ cập nhật avatar và thông tin hồ sơ ngay trong phiên hiện tại.
          </p>
          <Button type="submit" loading={loading} loadingText="Đang lưu hồ sơ">
            <Save className="h-4 w-4" />
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </section>
  );
}
