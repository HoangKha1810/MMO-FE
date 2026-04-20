import Link from 'next/link';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { listForumPrefixes } from '@/lib/forum-actions';
import { listForumFoldersForPosting } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function CreateForumThreadPage() {
  const { shell } = await getCurrentUserForShell();
  const [folders, prefixes] = await Promise.all([
    listForumFoldersForPosting(),
    listForumPrefixes(),
  ]);

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/user/forum" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Forum
        </Link>
        <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <MessageSquarePlus className="h-8 w-8 text-brand-blue" />
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Tạo thread mới</h1>
          <div className="mt-6">
            <LegacyActionForm
              endpoint="/api/forum/thread"
              submitLabel="Gửi duyệt thread"
              redirectTo="/user/forum/my-threads"
              fields={[
                {
                  name: 'forum_id',
                  label: 'Folder',
                  type: 'select',
                  required: true,
                  options: folders.map((folder) => ({
                    label: `${String(folder.category_name || 'Forum')} / ${String(folder.name)}`,
                    value: Number(folder.id),
                  })),
                },
                {
                  name: 'prefix_id',
                  label: 'Prefix',
                  type: 'select',
                  options: [{ label: 'Không dùng prefix', value: '' }, ...prefixes.map((prefix) => ({
                    label: String(prefix.name),
                    value: Number(prefix.id),
                  }))],
                },
                { name: 'title', label: 'Tiêu đề', required: true },
                { name: 'content', label: 'Nội dung', type: 'textarea', required: true },
              ]}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
