'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, FilePenLine, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readJsonResponse } from '@/lib/client-api';

export function FindJobDetailActions({
  jobId,
  isOwner,
}: {
  jobId: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');

  function apply() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/find-job/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId }),
        });
        const payload = await readJsonResponse(response, 'Không thể ứng tuyển');
        if (!payload.success) {
          throw new Error(payload.message || 'Không thể ứng tuyển');
        }
        toast.success(payload.message || 'Đã ứng tuyển');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể ứng tuyển');
      }
    });
  }

  function closeJob() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/find-job/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', job_id: jobId }),
        });
        const payload = await readJsonResponse(response, 'Không thể đóng tin');
        if (!payload.success) {
          throw new Error(payload.message || 'Không thể đóng tin');
        }
        toast.success(payload.message || 'Đã đóng tin tuyển dụng');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể đóng tin');
      }
    });
  }

  function report() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/find-job/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId, reason: reportReason, note: reportNote }),
        });
        const payload = await readJsonResponse(response, 'Không thể report');
        if (!payload.success) {
          throw new Error(payload.message || 'Không thể report');
        }
        toast.success(payload.message || 'Đã gửi report');
        setReportReason('');
        setReportNote('');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể report');
      }
    });
  }

  if (isOwner) {
    return (
      <div className="space-y-3">
        <Button asChild>
          <Link href={`/user/find-job/edit/${jobId}`}>
            <FilePenLine className="mr-1 h-4 w-4" />
            Sửa bài đăng
          </Link>
        </Button>
        <Button variant="outline" loading={isPending} onClick={closeJob}>
          <Trash2 className="mr-1 h-4 w-4" />
          Đóng tin này
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button loading={isPending} onClick={apply}>
        <Send className="mr-1 h-4 w-4" />
        Gửi ứng tuyển
      </Button>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Report bài đăng
        </div>
        <div className="grid gap-3">
          <input
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            placeholder="Lý do report"
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
          />
          <textarea
            value={reportNote}
            onChange={(event) => setReportNote(event.target.value)}
            rows={4}
            placeholder="Ghi chú thêm"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-7 outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
          />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" loading={isPending} onClick={report}>
              Gửi report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
