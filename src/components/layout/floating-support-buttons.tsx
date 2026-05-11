"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircleMore, Minus, Plus, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const ZALO_URL = "https://zalo.me/0589287713";
const TELEGRAM_URL = "https://t.me/TRUNGTAMMMOVN";

const HIDDEN_PREFIXES = ["/admin", "/vps", "/ai"];

function shouldHide(pathname: string) {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function FloatingSupportButtons() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (!pathname || shouldHide(pathname)) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]",
        "z-[80] flex flex-col items-end gap-3 sm:bottom-5 sm:right-5"
      )}
      aria-label="Liên hệ hỗ trợ nhanh"
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full border text-white",
          "bg-slate-950/80 shadow-[0_12px_28px_rgba(15,23,42,0.36)] backdrop-blur-xl",
          "transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
          collapsed ? "border-emerald-400/40 hover:bg-emerald-500/20" : "border-white/15 hover:bg-white/10"
        )}
        aria-label={collapsed ? "Mở liên hệ hỗ trợ" : "Thu gọn liên hệ hỗ trợ"}
        title={collapsed ? "Mở liên hệ hỗ trợ" : "Thu gọn liên hệ hỗ trợ"}
      >
        {collapsed ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
      </button>

      <div
        className={cn(
          "flex flex-col gap-3 transition-all duration-300 ease-out origin-bottom-right",
          collapsed ? "pointer-events-none scale-90 opacity-0 translate-y-2 max-h-0 overflow-hidden" : "scale-100 opacity-100 translate-y-0"
        )}
        aria-hidden={collapsed}
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
    </div>
  );
}
