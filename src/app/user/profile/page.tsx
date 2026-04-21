import { AppShell } from '@/components/layout/app-shell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ProfileEditorPanel } from '@/components/profile/profile-editor-panel';
import { MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { db } from '@/lib/db';
import { getCurrentUserForShell } from '@/lib/user-session';
import { Activity, AtSign, BadgeCheck, CalendarClock, ShieldCheck, UserCircle2, Wallet } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UserProfilePage() {
  const { raw, shell } = await getCurrentUserForShell();
  const logs = await db.activity_logs.findMany({
    where: { user_id: raw.id },
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  const profileRows = [
    ['Username', raw.username],
    ['Email', raw.email],
    ['Họ tên', raw.fullname || '—'],
    ['Rank', raw.rank || 'Member'],
    ['Nghề nghiệp', raw.occupation || '—'],
    ['Quê quán', raw.hometown || '—'],
    ['Liên hệ', raw.contact || '—'],
    ['Telegram', raw.telegram_username || '—'],
    ['Giới tính', raw.gender || '—'],
    ['Ngày sinh', raw.birthday ? new Intl.DateTimeFormat('vi-VN').format(raw.birthday) : '—'],
    ['Ngày tạo', raw.created_at.toLocaleString('vi-VN')],
    ['Lần đăng nhập cuối', raw.last_login ? raw.last_login.toLocaleString('vi-VN') : '—'],
  ];

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Profile"
          title={raw.fullname || raw.username}
          description={raw.bio || 'Quản lý hồ sơ, thông tin liên hệ, trạng thái tài khoản và hoạt động gần đây của bạn trên TRUNGTAMMMO trong một không gian thống nhất.'}
          stats={[
            { label: 'Username', value: raw.username, hint: raw.email, tone: 'blue' },
            { label: 'Rank', value: raw.rank || 'Member', hint: 'Phân hạng hiện tại', tone: 'emerald' },
            { label: 'Số dư', value: new Intl.NumberFormat('vi-VN').format(shell.balance) + ' ₫', hint: 'Đọc từ session shell', tone: 'amber' },
            { label: 'Hoạt động', value: String(logs.length), hint: '20 log gần nhất', tone: 'violet' },
          ]}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Avatar className="h-20 w-20 rounded-[1.8rem] border border-white/60 shadow-[0_26px_60px_-34px_rgba(37,99,235,0.75)]">
              <AvatarImage src={shell.avatar} className="object-cover" />
              <AvatarFallback className="rounded-[1.8rem] bg-gradient-to-br from-brand-blue via-sky-500 to-indigo-500 text-2xl font-black text-white">
                {raw.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="info" className="rounded-full px-3 py-1.5">
                  <AtSign className="h-3 w-3" />
                  {raw.username}
                </Badge>
                <Badge variant="success" className="rounded-full px-3 py-1.5">
                  <BadgeCheck className="h-3 w-3" />
                  {raw.rank || 'Member'}
                </Badge>
              </div>
              <p className="max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {raw.occupation || 'Chưa cập nhật nghề nghiệp'} · {raw.hometown || 'Chưa cập nhật quê quán'}
              </p>
            </div>
          </div>
        </PageHero>

        <ProfileEditorPanel
          initialProfile={{
            username: raw.username,
            email: raw.email,
            fullname: raw.fullname || '',
            avatar: shell.avatar,
            bio: raw.bio || '',
            occupation: raw.occupation || '',
            hometown: raw.hometown || '',
            contact: raw.contact || '',
            telegram_username: raw.telegram_username || '',
            expertise_tags: raw.expertise_tags || '',
            birthday: raw.birthday ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(raw.birthday) : '',
            gender: raw.gender || '',
          }}
        />

        <div className="grid gap-4 xl:grid-cols-4">
          <MetricCard
            label="Ví khả dụng"
            value={new Intl.NumberFormat('vi-VN').format(shell.balance) + ' ₫'}
            hint="Số dư hiển thị ở shell và hồ sơ."
            tone="blue"
            icon={<Wallet className="h-4 w-4" />}
          />
          <MetricCard
            label="Ngày tạo"
            value={new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(raw.created_at)}
            hint="Ngày tham gia hệ thống."
            tone="emerald"
            icon={<CalendarClock className="h-4 w-4" />}
          />
          <MetricCard
            label="Liên hệ"
            value={raw.contact || '—'}
            hint="Thông tin liên hệ do user cập nhật."
            tone="amber"
            icon={<UserCircle2 className="h-4 w-4" />}
          />
          <MetricCard
            label="Telegram"
            value={raw.telegram_username || '—'}
            hint="Username kết nối nhanh."
            tone="violet"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <SectionPanel>
            <SectionHeader
              eyebrow="Account Details"
              title="Thông tin tài khoản"
              description="Kiểm tra lại thông tin cá nhân, trạng thái thành viên và các dữ liệu liên hệ đang gắn với tài khoản."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {profileRows.map(([label, value]) => (
                <div key={label} className="rounded-[1.35rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">{label}</div>
                  <div className="mt-2 text-sm font-bold leading-7 text-slate-800 dark:text-slate-100">{value}</div>
                </div>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel>
            <SectionHeader
              eyebrow="Recent Activity"
              title="Hoạt động gần đây"
              description="Theo dõi những thao tác và dấu mốc gần đây để nắm nhanh lịch sử hoạt động của tài khoản."
            />
            <div className="mt-5 space-y-3">
              {logs.length === 0 ? (
                <div className="rounded-[1.35rem] border border-dashed border-slate-200 p-6 text-sm font-semibold text-slate-400 dark:border-white/10">
                  Chưa có log hoạt động.
                </div>
              ) : logs.map((log) => (
                <div key={log.id} className="flex gap-3 rounded-[1.35rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-7 text-slate-700 dark:text-slate-200">{log.activity}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      {log.created_at.toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionPanel>
        </div>
      </div>
    </AppShell>
  );
}
