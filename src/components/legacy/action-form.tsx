'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readJsonResponse } from '@/lib/client-api';

interface Field {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  hidden?: boolean;
  options?: Array<{ label: string; value: string | number }>;
}

export function LegacyActionForm({
  endpoint,
  fields,
  submitLabel,
  redirectTo,
  defaults,
}: {
  endpoint: string;
  fields: Field[];
  submitLabel: string;
  redirectTo?: string | ((payload: Record<string, unknown>) => string);
  defaults?: Record<string, string | number>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string | number>>(defaults || {});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = await readJsonResponse(response, 'Không thể xử lý');
      if (!payload.success) {
        throw new Error(payload.message || 'Không thể xử lý');
      }

      toast.success(payload.message || 'Đã xử lý');
      if (redirectTo) {
        startPageTransition();
        router.push(typeof redirectTo === 'function' ? redirectTo(payload) : redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map((field) => (
        field.hidden ? (
          <input
            key={field.name}
            type="hidden"
            value={String(values[field.name] ?? '')}
            onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
          />
        ) : (
        <label key={field.name} className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{field.label}</span>
          {field.type === 'textarea' ? (
            <textarea
              value={String(values[field.name] ?? '')}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              placeholder={field.placeholder}
              required={field.required}
              rows={7}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-brand-blue dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          ) : field.type === 'select' ? (
            <select
              value={String(values[field.name] ?? '')}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              required={field.required}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-brand-blue dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Chọn...</option>
              {field.options?.map((option) => (
                <option key={String(option.value)} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <Input
              type={field.type || 'text'}
              value={String(values[field.name] ?? '')}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}
        </label>
        )
      ))}

      <Button type="submit" disabled={loading} className="w-full" loading={loading} loadingText="Đang xử lý...">
        <Send className="mr-2 h-4 w-4" />
        {submitLabel}
      </Button>
    </form>
  );
}
