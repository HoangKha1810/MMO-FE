'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShoppingCart, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { useSessionUser } from '@/hooks/use-session-user';

interface CartItem {
  id: number;
  quantity: number;
  resource: {
    id: number;
    title: string;
    category: string | null;
    price: number;
    stock: number;
  };
}

export default function UserCartPage() {
  const currentUser = useSessionUser();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCart() {
      try {
        const response = await fetch('/api/user/cart');
        const payload = await response.json();
        if (active && payload.success) {
          setItems(payload.data);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCart();

    return () => {
      active = false;
    };
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.resource.price * item.quantity, 0),
    [items]
  );

  async function handleRemove(itemId: number) {
    setRemovingId(itemId);
    try {
      const response = await fetch('/api/user/cart', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });
      const payload = await response.json();
      if (payload.success) {
        setItems((current) => current.filter((item) => item.id !== itemId));
      }
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <AppShell user={currentUser.data}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
            Giỏ hàng
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Theo dõi các tài nguyên MMO đã thêm và chuẩn bị cho bước thanh toán tiếp theo.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-[2rem] border border-slate-200 bg-white px-6 py-20 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-20 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <ShoppingCart className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-500" />
            <div className="mt-4 text-lg font-black uppercase tracking-[0.02em] text-slate-900 dark:text-white">
              Chưa có sản phẩm nào trong giỏ
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Hãy thêm tài nguyên ở module Tài nguyên MMO để bắt đầu.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                        {item.resource.category || 'Tài nguyên'}
                      </div>
                      <h2 className="mt-2 text-xl font-black uppercase tracking-[0.02em] text-slate-900 dark:text-white">
                        {item.resource.title}
                      </h2>
                      <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        Số lượng: <span className="font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Kho khả dụng: <span className="font-bold text-slate-900 dark:text-white">{item.resource.stock}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-black text-slate-900 dark:text-white">
                        {new Intl.NumberFormat('vi-VN').format(item.resource.price * item.quantity)}đ
                      </div>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => handleRemove(item.id)}
                        disabled={removingId === item.id}
                      >
                        {removingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Tổng kết</div>
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>Số mặt hàng</span>
                  <span className="font-bold">{items.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>Tổng số lượng</span>
                  <span className="font-bold">{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div className="border-t border-slate-200 pt-4 dark:border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Tạm tính</div>
                  <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">
                    {new Intl.NumberFormat('vi-VN').format(total)}đ
                  </div>
                </div>
              </div>
              <Button className="mt-6 w-full" size="xl">
                Tiếp tục thanh toán
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
