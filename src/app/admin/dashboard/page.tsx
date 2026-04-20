import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

async function getAdminStats() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      lockedUsers,
      twofaUsers,
      totalLiability,
      todayDeposits,
      todaySmmOrders,
      pendingReports,
      blacklistedIps,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      deposits7d,
      deposits30d,
    ] = await Promise.all([
      db.users.count(),
      db.users.count({ where: { status: { in: ['banned', 'locked', 'suspended'] } } }),
      db.users.count({ where: { fa_enabled: true } }),
      db.users.aggregate({ _sum: { balance: true } }),
      db.transactions.aggregate({
        where: { type: 'deposit', status: 'success', created_at: { gte: today } },
        _sum: { amount: true },
      }),
      db.smm_orders.count({ where: { created_at: { gte: today } } }),
      db.forum_threads.count({ where: { status: 'pending' } }),
      db.ip_blacklist.count(),
      db.users.count({ where: { created_at: { gte: today } } }),
      db.users.count({ where: { created_at: { gte: weekAgo } } }),
      db.users.count({ where: { created_at: { gte: monthAgo } } }),
      db.transactions.aggregate({
        where: { type: 'deposit', status: 'success', created_at: { gte: weekAgo } },
        _sum: { amount: true },
      }),
      db.transactions.aggregate({
        where: { type: 'deposit', status: 'success', created_at: { gte: monthAgo } },
        _sum: { amount: true },
      }),
    ]);

    const pulse = {
      total_users: totalUsers,
      locked_users: lockedUsers,
      twofa_users: twofaUsers,
      total_liability: toNumber(totalLiability._sum.balance, 0),
      realtime_orders: todaySmmOrders,
      smm_delayed: 0,
      blacklisted_ips: blacklistedIps,
      pending_reports: pendingReports,
    };

    const statsToday = {
      smm_revenue: 0, smm_cost: 0, smm_profit: 0, smm_total: todaySmmOrders,
      smm_success: 0, smm_pending: 0, smm_processing: 0, smm_refunded: 0,
      amx_revenue: 0, amx_cost: 0, amx_profit: 0, amx_success: 0,
      amx_failed: 0, amx_pending: 0, amx_total: 0,
      forum_posts: 0, forum_threads: 0,
      game_revenue: 0, game_orders: 0,
      new_users: newUsersToday,
      deposit: toNumber(todayDeposits._sum.amount, 0),
      spent: 0, refunds_money: 0, active_users: 0,
      success_rate: 0,
    };

    const stats7d = {
      ...statsToday,
      new_users: newUsers7d,
      deposit: toNumber(deposits7d._sum.amount, 0),
    };

    const stats30d = {
      ...statsToday,
      new_users: newUsers30d,
      deposit: toNumber(deposits30d._sum.amount, 0),
    };

    const topUsers = await db.users.findMany({
      orderBy: { balance: 'desc' },
      take: 5,
      select: { username: true, balance: true, role: true },
    });

    const activityLogs = await db.activity_logs.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      include: { user: { select: { username: true, role: true } } },
    });

    return {
      pulse,
      statsToday,
      stats7d,
      stats30d,
      topUsers: topUsers.map((user) => ({ ...user, balance: toNumber(user.balance, 0) })),
      activityLogs,
    };
  } catch (error) {
    console.error('Admin stats error:', error);
    return {
      pulse: { total_users: 0, locked_users: 0, twofa_users: 0, total_liability: 0, realtime_orders: 0, smm_delayed: 0, blacklisted_ips: 0, pending_reports: 0, smm_platform_stats: [], smm_top_services: [] },
      statsToday: { smm_revenue: 0, smm_cost: 0, smm_profit: 0, smm_total: 0, smm_success: 0, smm_pending: 0, smm_processing: 0, smm_refunded: 0, amx_revenue: 0, amx_cost: 0, amx_profit: 0, amx_success: 0, amx_failed: 0, amx_pending: 0, amx_total: 0, forum_posts: 0, forum_threads: 0, game_revenue: 0, game_orders: 0, new_users: 0, deposit: 0, spent: 0, refunds_money: 0, active_users: 0, success_rate: 0 },
      stats7d: null as null,
      stats30d: null as null,
      topUsers: [],
      activityLogs: [],
    };
  }
}

async function getUserData(userId: number) {
  try {
    return await db.users.findUnique({
      where: { id: userId },
      select: { username: true, email: true, balance: true, rank: true, role: true, avatar: true, is_blue_tick: true },
    });
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    redirect('/auth/login');
  }

  const [user, stats] = await Promise.all([
    getUserData(userId),
    getAdminStats(),
  ]);

  if (!user || user.role !== 'admin') {
    redirect('/user/home');
  }

  const { pulse, statsToday, stats7d, stats30d, topUsers, activityLogs } = stats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
            Giám sát hệ thống
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hệ thống vận hành ổn định</p>
          </div>
        </div>
      </div>

      {/* Pulse Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5">
        {[
          { label: 'Thành viên', value: pulse.total_users, sub: `${pulse.locked_users} Bị khóa`, subColor: 'text-rose-500', icon: '👥', color: 'text-blue-500' },
          { label: 'Tổng dư TV (Nợ)', value: pulse.total_liability, suffix: 'đ', icon: '💼', color: 'text-amber-500' },
          { label: 'Hệ thống SMM', value: pulse.realtime_orders, sub: 'Queue', icon: '🛒', color: 'text-indigo-500' },
          { label: 'Bảo mật (IP)', value: pulse.blacklisted_ips, sub: 'Chặn', icon: '🚫', color: 'text-rose-500' },
          { label: 'Tố cáo Forum', value: pulse.pending_reports, sub: 'Mới', icon: '🚨', color: 'text-orange-500' },
          { label: 'Người dùng mới (Hôm nay)', value: statsToday.new_users, icon: '🆕', color: 'text-emerald-500' },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{card.label}</span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <div className="text-xl font-black text-slate-800 dark:text-white">
              {typeof card.value === 'number'
                ? new Intl.NumberFormat('vi-VN').format(card.value)
                : card.value}
              {card.suffix && <span className="text-xs opacity-40 italic font-medium ml-0.5">{card.suffix}</span>}
            </div>
            {card.sub && (
              <div className="mt-1 text-[8px] font-bold uppercase">
                <span className={card.subColor}>{card.sub}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Performance Sections */}
      {[
        { label: 'Hiệu suất Hôm nay', data: statsToday, color: 'blue' },
        { label: 'Hiệu suất 7 ngày qua', data: stats7d, color: 'violet' },
        { label: 'Hiệu suất 30 ngày qua', data: stats30d, color: 'purple' },
      ].filter(s => s.data).map((section) => (
        <div key={section.label} className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className={`h-5 w-1 bg-${section.color}-500 rounded-full`} />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {section.label}
            </h2>
          </div>

          {/* SMM Row */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Doanh thu SMM', value: section.data!.smm_revenue, icon: '📈', color: 'text-indigo-500' },
              { label: 'Biên lợi nhuận', value: section.data!.smm_revenue > 0 ? ((section.data!.smm_profit / section.data!.smm_revenue) * 100).toFixed(1) + '%' : '0%', icon: '💹', color: 'text-blue-500' },
              { label: 'Đơn hàng SMM', value: section.data!.smm_total, icon: '🛍️', color: 'text-purple-500' },
              { label: 'Chất lượng & Hoàn', value: section.data!.smm_total > 0 ? ((section.data!.smm_refunded / section.data!.smm_total) * 100).toFixed(1) + '%' : '0%', icon: '🛡️', color: 'text-rose-500' },
            ].map((item) => (
              <div key={item.label} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                  <span className="text-lg">{item.icon}</span>
                </div>
                <div className="text-lg font-black text-slate-800 dark:text-white">
                  {typeof item.value === 'number'
                    ? new Intl.NumberFormat('vi-VN').format(item.value)
                    : item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Finance Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-5">
            {[
              { label: 'Tăng trưởng TV', value: `+${section.data!.new_users}`, color: 'text-slate-800 dark:text-white' },
              { label: 'Dòng tiền nạp', value: section.data!.deposit, color: 'text-emerald-600', icon: '↑' },
              { label: 'Tiền tiêu dùng', value: section.data!.spent, color: 'text-blue-600', icon: '↓' },
              { label: 'SMM Orders', value: section.data!.smm_total, color: 'text-slate-800 dark:text-white' },
              { label: 'Hoàn tiền', value: section.data!.refunds_money, color: 'text-rose-500' },
              { label: 'User Hoạt động', value: section.data!.active_users, color: 'text-amber-500' },
              { label: 'Bài viết Forum', value: section.data!.forum_posts, color: 'text-purple-500' },
            ].map((item) => (
              <div key={item.label} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{item.label}</div>
                <div className={`text-lg font-black tracking-tight ${item.color}`}>
                  {typeof item.value === 'number'
                    ? new Intl.NumberFormat('vi-VN').format(item.value)
                    : item.value}
                  {item.icon && <span className="text-[9px] opacity-40 font-bold uppercase ml-0.5">{item.icon}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Activity Feed */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                Phát hiện hoạt động
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                Giám sát người dùng & Quản trị viên
              </p>
            </div>
            <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="p-4 space-y-3">
            {activityLogs.length === 0 ? (
              <p className="text-center py-8 text-[10px] text-slate-400 font-bold uppercase italic">
                Chưa có hoạt động nào
              </p>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    log.user?.role === 'admin' ? 'bg-rose-500/10 text-rose-500' : 'bg-brand-blue/10 text-brand-blue'
                  }`}>
                    <span>{log.user?.role === 'admin' ? '🛡️' : '👤'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase">
                        {log.user?.username || 'System'}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 italic">
                      "{log.activity}"
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Users */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">
                Top 5 Đại gia
              </h3>
              <span className="text-xl">👑</span>
            </div>
            <div className="space-y-4">
              {topUsers.length === 0 ? (
                <p className="text-center py-8 text-[10px] text-slate-400 font-bold uppercase italic">
                  Chưa có dữ liệu
                </p>
              ) : (
                topUsers.map((user, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl hover:translate-x-1 transition-transform cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-black text-brand-blue border border-slate-100 dark:border-white/5 group-hover:border-brand-blue transition-colors">
                        {user.username.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-800 dark:text-white">{user.username}</div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{user.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-black text-brand-blue">
                        {new Intl.NumberFormat('vi-VN').format(user.balance)} đ
                      </div>
                      <div className="text-[8px] font-bold text-slate-300 uppercase">Số dư</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
