"use client";

import { usePathname } from "next/navigation";
import { MessageCircleMore, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const ZALO_URL = "https://zalo.me/0589287713";
const TELEGRAM_URL = "https://t.me/TRUNGTAMMMOVN";

const HIDDEN_PREFIXES = ["/admin", "/vps", "/ai"];

function shouldHide(pathname: string) {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function FloatingSupportButtons() {
  const pathname = usePathname();

  if (!pathname || shouldHide(pathname)) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]",
        "z-[80] flex flex-col gap-3 sm:bottom-5 sm:right-5"
      )}
      aria-label="Liên hệ hỗ trợ nhanh"
    >
      <a
        href={ZALO_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "support-fab group relative flex items-center gap-3 overflow-hidden rounded-full",
          "border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(37,99,235,0.96),rgba(56,189,248,0.96))]",
          "px-3 py-3 text-white shadow-[0_16px_40px_rgba(14,116,144,0.42)]",
          "transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        )}
      >
        <span className="support-fab__shine" />
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/14 backdrop-blur">
          <MessageCircleMore className="h-5 w-5" />
        </span>
        <span className="hidden pr-2 text-sm font-black uppercase tracking-[0.18em] sm:inline">
          Zalo
        </span>
      </a>

      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "support-fab group relative flex items-center gap-3 overflow-hidden rounded-full",
          "border border-fuchsia-400/30 bg-[linear-gradient(135deg,rgba(88,28,135,0.96),rgba(219,39,119,0.96))]",
          "px-3 py-3 text-white shadow-[0_16px_40px_rgba(124,58,237,0.38)]",
          "transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
        )}
      >
        <span className="support-fab__shine support-fab__shine--alt" />
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/14 backdrop-blur">
          <Send className="h-5 w-5" />
        </span>
        <span className="hidden pr-2 text-sm font-black uppercase tracking-[0.18em] sm:inline">
          Telegram
        </span>
      </a>
    </div>
  );
}
