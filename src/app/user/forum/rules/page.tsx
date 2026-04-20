import { ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { getCurrentUserForShell } from '@/lib/user-session';

export default async function ForumRulesPage() {
  const { shell } = await getCurrentUserForShell();
  const rules = [
    'Không spam, không kéo traffic bẩn, không đăng nội dung lừa đảo.',
    'Mua bán phải ghi rõ điều kiện, bảo hành, cách giao hàng và bằng chứng uy tín nếu có.',
    'Không public thông tin cá nhân/API key/token của người khác.',
    'Admin có quyền ẩn, khóa, ghim hoặc xử lý bài viết theo log và report.',
  ];

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <ShieldCheck className="h-9 w-9 text-emerald-500" />
        <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Nội quy forum</h1>
        <div className="mt-6 space-y-3">
          {rules.map((rule, index) => (
            <div key={rule} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rule {index + 1}</div>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{rule}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
