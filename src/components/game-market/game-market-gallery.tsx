'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type GameMarketGalleryProps = {
  images: string[];
  title: string;
};

export function GameMarketGallery({ images, title }: GameMarketGalleryProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  function openAt(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  function showPrevious() {
    setActiveIndex((current) => (current === 0 ? images.length - 1 : current - 1));
  }

  function showNext() {
    setActiveIndex((current) => (current === images.length - 1 ? 0 : current + 1));
  }

  useEffect(() => {
    if (!open || images.length <= 1) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrevious();
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, images.length]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="mb-6 grid gap-3">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="group relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-100 text-left dark:border-white/10 dark:bg-slate-950/40"
        >
          <img src={images[0]} alt={title} className="aspect-[16/9] h-full w-full object-cover transition duration-300 group-hover:scale-[1.015]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent px-4 py-3 text-white">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
              Ảnh 1 / {images.length}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
              <Expand className="h-3.5 w-3.5" />
              Xem full ảnh
            </span>
          </div>
        </button>

        {images.length > 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {images.slice(1).map((image, index) => (
              <button
                key={`${image}-${index + 1}`}
                type="button"
                onClick={() => openAt(index + 1)}
                className="group relative overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-100 text-left dark:border-white/10 dark:bg-slate-950/40"
              >
                <img
                  src={image}
                  alt={`${title} ${index + 2}`}
                  className="aspect-[16/10] h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent px-4 py-3 text-white">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
                    Ảnh {index + 2}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                    <Expand className="h-3.5 w-3.5" />
                    Mở lớn
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/86 backdrop-blur-md" />
          <Dialog.Content className="fixed inset-0 z-[121] flex items-center justify-center p-3 outline-none sm:p-6">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>

            <div className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,31,0.98),rgba(8,13,24,0.96))] shadow-[0_40px_140px_-50px_rgba(15,23,42,0.85)]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black uppercase tracking-[-0.03em] text-white sm:text-base">
                    {title}
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Ảnh {activeIndex + 1} / {images.length}
                  </div>
                </div>

                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label="Đóng xem ảnh"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="relative flex min-h-[340px] items-center justify-center bg-slate-950/50 px-3 py-4 sm:min-h-[560px] sm:px-6">
                <img
                  src={images[activeIndex]}
                  alt={`${title} ${activeIndex + 1}`}
                  className="max-h-[74vh] w-auto max-w-full rounded-[1.4rem] object-contain"
                />

                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={showPrevious}
                      className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/72 text-slate-100 transition hover:bg-slate-900 sm:left-5"
                      aria-label="Ảnh trước"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={showNext}
                      className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/72 text-slate-100 transition hover:bg-slate-900 sm:right-5"
                      aria-label="Ảnh tiếp theo"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>

              {images.length > 1 ? (
                <div className="grid max-h-36 grid-cols-3 gap-3 overflow-y-auto border-t border-white/10 p-3 sm:grid-cols-5 sm:p-4">
                  {images.map((image, index) => (
                    <button
                      key={`${image}-thumb-${index}`}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={cn(
                        'overflow-hidden rounded-[1rem] border bg-slate-950/55 transition',
                        index === activeIndex
                          ? 'border-brand-blue shadow-[0_0_0_1px_rgba(59,130,246,0.5)]'
                          : 'border-white/10 hover:border-white/20'
                      )}
                      aria-label={`Xem ảnh ${index + 1}`}
                    >
                      <img src={image} alt={`${title} thumbnail ${index + 1}`} className="aspect-[16/10] h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
