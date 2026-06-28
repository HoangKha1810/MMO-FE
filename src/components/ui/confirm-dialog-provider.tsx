'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, CheckCircle2, HelpCircle, ShieldCheck, WalletCards } from 'lucide-react';
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

type ConfirmTone = 'default' | 'brand' | 'danger' | 'payment';

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
  requireAgreement?: boolean;
  agreementText?: string;
};

type ConfirmDialogContextValue = {
  confirm: (request: ConfirmDialogRequest) => Promise<boolean>;
  alert: (request: Omit<ConfirmDialogRequest, 'kind' | 'cancelText'>) => Promise<void>;
};

type QueuedDialogRequest = Required<
  Pick<ConfirmDialogRequest, 'description' | 'confirmText' | 'cancelText' | 'tone' | 'kind'>
> &
  Pick<ConfirmDialogRequest, 'title' | 'linkHref' | 'linkText' | 'linkTarget' | 'agreementText'> & {
    requireAgreement: boolean;
    resolve: (value: boolean) => void;
  };

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

const toneConfig: Record<
  ConfirmTone,
  {
    icon: typeof HelpCircle;
    iconClassName: string;
    accentClassName: string;
    shellClassName: string;
    confirmVariant: 'default' | 'destructive';
  }
> = {
  default: {
    icon: HelpCircle,
    iconClassName: 'text-slate-500 dark:text-slate-300',
    accentClassName: 'from-slate-500/16 via-slate-300/10 to-transparent dark:from-white/10 dark:via-white/4',
    shellClassName: 'border-slate-200/80 bg-white/90 dark:border-white/10 dark:bg-white/[0.05]',
    confirmVariant: 'default',
  },
  brand: {
    icon: ShieldCheck,
    iconClassName: 'text-brand-blue',
    accentClassName: 'from-brand-blue/22 via-cyan-400/12 to-transparent dark:from-brand-blue/24 dark:via-cyan-300/10',
    shellClassName: 'border-brand-blue/20 bg-brand-blue/10 dark:border-brand-blue/30 dark:bg-brand-blue/12',
    confirmVariant: 'default',
  },
  danger: {
    icon: AlertTriangle,
    iconClassName: 'text-rose-500',
    accentClassName: 'from-rose-500/20 via-orange-400/12 to-transparent dark:from-rose-500/24 dark:via-orange-300/10',
    shellClassName: 'border-rose-400/25 bg-rose-500/10 dark:border-rose-300/20 dark:bg-rose-500/12',
    confirmVariant: 'destructive',
  },
  payment: {
    icon: WalletCards,
    iconClassName: 'text-cyan-300 dark:text-cyan-200',
    accentClassName: 'from-cyan-400/24 via-brand-blue/16 to-emerald-400/10 dark:from-cyan-300/18 dark:via-brand-blue/18 dark:to-emerald-300/10',
    shellClassName: 'border-cyan-300/30 bg-cyan-400/10 dark:border-cyan-200/20 dark:bg-cyan-300/10',
    confirmVariant: 'default',
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
    requireAgreement: Boolean(request.requireAgreement),
    agreementText: request.agreementText,
    resolve,
  };
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<QueuedDialogRequest[]>([]);
  const currentRef = useRef<QueuedDialogRequest | null>(null);
  const [current, setCurrent] = useState<QueuedDialogRequest | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() || null;
    currentRef.current = next;
    setAgreementAccepted(false);
    setCurrent(next);
  }, []);

  const resolveCurrent = useCallback(
    (value: boolean) => {
      const active = currentRef.current;
      currentRef.current = null;
      setCurrent(null);
      setAgreementAccepted(false);
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
  const isPaymentTone = current?.tone === 'payment';
  const confirmDisabled = Boolean(current?.requireAgreement && !agreementAccepted);

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
          <Dialog.Overlay className="vault-dialog-backdrop fixed inset-0 z-[300] bg-[linear-gradient(135deg,rgba(2,6,23,0.82),rgba(6,12,28,0.72))] backdrop-blur-md" />
          <Dialog.Content
            className={cn(
              'vault-dialog-card fixed left-1/2 top-1/2 z-[301] w-[calc(100vw-1.5rem)] max-w-[35rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,252,0.96))] p-5 shadow-[0_44px_120px_-52px_rgba(15,23,42,0.55)] outline-none dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,16,29,0.98),rgba(6,12,23,0.98))] sm:p-6',
              isPaymentTone &&
                'vault-wallet-card max-w-[39rem] border-cyan-300/30 bg-[linear-gradient(160deg,rgba(12,35,54,0.98),rgba(4,10,22,0.99)_46%,rgba(7,22,37,0.98))] shadow-[0_40px_120px_-44px_rgba(34,211,238,0.72)]'
            )}
          >
            {current ? (
              <>
                <div
                  className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-100',
                    tone.accentClassName
                  )}
                />
                {isPaymentTone ? (
                  <>
                    <div className="vault-dialog-rail pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />
                    <div className="vault-dialog-scan pointer-events-none absolute inset-x-0 top-0 h-full bg-[linear-gradient(110deg,transparent_0%,rgba(125,211,252,0.10)_42%,transparent_68%)]" />
                  </>
                ) : null}
                <div className="vault-dialog-tracer pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-70" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.12]">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:28px_28px]" />
                </div>

                <div className="relative">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'vault-dialog-icon relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] border shadow-[0_20px_40px_-28px_rgba(37,99,235,0.28)]',
                        tone.shellClassName
                      )}
                    >
                      {isPaymentTone ? (
                        <span className="vault-dialog-icon-ring pointer-events-none absolute -inset-1 rounded-[1.35rem] border border-cyan-200/30" />
                      ) : null}
                      <Icon className={cn('h-6 w-6', tone.iconClassName)} />
                    </div>
                    <div className="min-w-0 space-y-2 pt-1">
                      <Dialog.Title className="text-lg font-black uppercase tracking-normal text-slate-950 dark:text-white sm:text-xl">
                        {current.title}
                      </Dialog.Title>
                      <Dialog.Description className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300 sm:text-[15px]">
                        {current.description}
                      </Dialog.Description>
                    </div>
                  </div>

                  {current.requireAgreement ? (
                    <label className="mt-5 flex cursor-pointer gap-3 rounded-[1.15rem] border border-cyan-200/20 bg-cyan-300/[0.07] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-cyan-200/35">
                      <input
                        type="checkbox"
                        checked={agreementAccepted}
                        onChange={(event) => setAgreementAccepted(event.target.checked)}
                        className="mt-1 h-5 w-5 shrink-0 rounded border-cyan-200/40 bg-slate-950/40 text-brand-blue accent-brand-blue"
                      />
                      <span className="space-y-1">
                        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                          <CheckCircle2 className="h-4 w-4" />
                          Xác nhận điều khoản thuê
                        </span>
                        <span className="block text-sm font-semibold leading-6 text-slate-200">
                          {current.agreementText || 'Tôi đã đọc và đồng ý với điều khoản của dịch vụ này.'}
                        </span>
                      </span>
                    </label>
                  ) : null}

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
                      disabled={confirmDisabled}
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
