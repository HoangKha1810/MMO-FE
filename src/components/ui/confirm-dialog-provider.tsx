'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, HelpCircle, ShieldCheck } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConfirmTone = 'default' | 'brand' | 'danger';

type ConfirmDialogRequest = {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  kind?: 'confirm' | 'alert';
  linkHref?: string;
  linkText?: string;
  linkTarget?: string;
};

type ConfirmDialogContextValue = {
  confirm: (request: ConfirmDialogRequest) => Promise<boolean>;
  alert: (request: Omit<ConfirmDialogRequest, 'kind' | 'cancelText'>) => Promise<void>;
};

type QueuedDialogRequest = Required<
  Pick<ConfirmDialogRequest, 'description' | 'confirmText' | 'cancelText' | 'tone' | 'kind'>
> &
  Pick<ConfirmDialogRequest, 'title' | 'linkHref' | 'linkText' | 'linkTarget'> & {
    resolve: (value: boolean) => void;
  };

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

const toneConfig: Record<
  ConfirmTone,
  {
    icon: typeof HelpCircle;
    iconClassName: string;
    accentClassName: string;
    confirmVariant: 'default' | 'destructive';
  }
> = {
  default: {
    icon: HelpCircle,
    iconClassName: 'text-slate-500 dark:text-slate-300',
    accentClassName: 'from-slate-500/16 via-slate-300/10 to-transparent dark:from-white/10 dark:via-white/4',
    confirmVariant: 'default',
  },
  brand: {
    icon: ShieldCheck,
    iconClassName: 'text-brand-blue',
    accentClassName: 'from-brand-blue/22 via-cyan-400/12 to-transparent dark:from-brand-blue/24 dark:via-cyan-300/10',
    confirmVariant: 'default',
  },
  danger: {
    icon: AlertTriangle,
    iconClassName: 'text-rose-500',
    accentClassName: 'from-rose-500/20 via-orange-400/12 to-transparent dark:from-rose-500/24 dark:via-orange-300/10',
    confirmVariant: 'destructive',
  },
};

function normalizeRequest(
  request: ConfirmDialogRequest,
  resolve: (value: boolean) => void
): QueuedDialogRequest {
  return {
    title: request.title || (request.kind === 'alert' ? 'Thông báo hệ thống' : 'Xác nhận thao tác'),
    description: request.description,
    confirmText: request.confirmText || (request.kind === 'alert' ? 'Đã hiểu' : 'Xác nhận'),
    cancelText: request.cancelText || 'Hủy',
    tone: request.tone || 'brand',
    kind: request.kind || 'confirm',
    linkHref: request.linkHref,
    linkText: request.linkText,
    linkTarget: request.linkTarget,
    resolve,
  };
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<QueuedDialogRequest[]>([]);
  const currentRef = useRef<QueuedDialogRequest | null>(null);
  const [current, setCurrent] = useState<QueuedDialogRequest | null>(null);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() || null;
    currentRef.current = next;
    setCurrent(next);
  }, []);

  const resolveCurrent = useCallback(
    (value: boolean) => {
      const active = currentRef.current;
      currentRef.current = null;
      setCurrent(null);
      active?.resolve(value);
      window.setTimeout(() => {
        if (!currentRef.current && queueRef.current.length > 0) {
          showNext();
        }
      }, 10);
    },
    [showNext]
  );

  const confirm = useCallback(
    (request: ConfirmDialogRequest) =>
      new Promise<boolean>((resolve) => {
        queueRef.current.push(normalizeRequest({ ...request, kind: 'confirm' }, resolve));
        if (!currentRef.current) {
          showNext();
        }
      }),
    [showNext]
  );

  const alert = useCallback(
    async (request: Omit<ConfirmDialogRequest, 'kind' | 'cancelText'>) => {
      await new Promise<boolean>((resolve) => {
        queueRef.current.push(normalizeRequest({ ...request, kind: 'alert' }, resolve));
        if (!currentRef.current) {
          showNext();
        }
      });
    },
    [showNext]
  );

  useEffect(() => {
    return () => {
      queueRef.current = [];
      currentRef.current = null;
    };
  }, []);

  const value = useMemo<ConfirmDialogContextValue>(
    () => ({
      confirm,
      alert,
    }),
    [alert, confirm]
  );

  const tone = toneConfig[current?.tone || 'brand'];
  const Icon = tone.icon;

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}

      <Dialog.Root
        open={Boolean(current)}
        onOpenChange={(open) => {
          if (!open && currentRef.current) {
            resolveCurrent(false);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="confirm-dialog-overlay fixed inset-0 z-[300] bg-slate-950/58 backdrop-blur-md" />
          <Dialog.Content
            className="confirm-dialog-content fixed left-1/2 top-1/2 z-[301] w-[calc(100vw-1.5rem)] max-w-[32rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,252,0.96))] p-5 shadow-[0_44px_120px_-52px_rgba(15,23,42,0.55)] outline-none dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(11,17,31,0.98),rgba(8,13,24,0.96))] sm:p-6"
          >
            {current ? (
              <>
                <div
                  className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-100',
                    tone.accentClassName
                  )}
                />
                <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light dark:opacity-30">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.25),transparent_48%)]" />
                </div>

                <div className="relative">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] border border-slate-200/80 bg-white/90 shadow-[0_20px_40px_-28px_rgba(37,99,235,0.28)] dark:border-white/10 dark:bg-white/[0.05]">
                      <Icon className={cn('h-6 w-6', tone.iconClassName)} />
                    </div>
                    <div className="min-w-0 space-y-2 pt-1">
                      <Dialog.Title className="text-lg font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white sm:text-xl">
                        {current.title}
                      </Dialog.Title>
                      <Dialog.Description className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300 sm:text-[15px]">
                        {current.description}
                      </Dialog.Description>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    {current.kind === 'confirm' ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => resolveCurrent(false)}
                        className="w-full sm:w-auto"
                      >
                        {current.cancelText}
                      </Button>
                    ) : null}
                    {current.linkHref && current.linkText ? (
                      <Button asChild variant="outline" className="w-full sm:w-auto">
                        <a
                          href={current.linkHref}
                          target={current.linkTarget || '_self'}
                          rel={current.linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
                          onClick={() => resolveCurrent(true)}
                        >
                          {current.linkText}
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant={tone.confirmVariant}
                      onClick={() => resolveCurrent(true)}
                      className="w-full sm:w-auto"
                    >
                      {current.confirmText}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }

  return context;
}
