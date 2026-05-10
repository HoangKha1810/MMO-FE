import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowRight, Cloud, Database, Rocket, Server, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { db } from '@/lib/db';
import { buildLegacyAssetUrl, getLegacySettingsMap } from '@/lib/legacy-settings';
import { siteUrl } from '@/lib/seo';
import { toNumber } from '@/lib/utils';

type VpsCatalogRow = {
  id: number | bigint;
  sku: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  sale_price: number | string | bigint;
  compare_price: number | string | bigint | null;
  badge_text: string | null;
  hero_gradient_from: string;
  hero_gradient_to: string;
  is_featured: number | boolean | null;
  sort_order: number | string | bigint;
};

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) return null;

  const user = await db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      fullname: true,
      balance: true,
      game_balance: true,
      rank: true,
      role: true,
      avatar: true,
      is_blue_tick: true,
    },
  });

  if (!user) return null;

  return {
    username: user.username,
    email: user.email,
    balance: toNumber(user.balance, 0),
    game_balance: toNumber(user.game_balance, 0),
    rank: user.rank || 'Member',
    role: String(user.role || 'member'),
    avatar: buildLegacyAssetUrl(user.avatar) || undefined,
    is_blue_tick: Boolean(user.is_blue_tick),
  };
}

async function listVpsProducts() {
  const rows = await db.$queryRaw<VpsCatalogRow[]>`
    SELECT id, sku, title, slug, short_description, description, sale_price, compare_price, badge_text,
           hero_gradient_from, hero_gradient_to, is_featured, sort_order
    FROM vps_catalog_items
    WHERE is_active = 1
    ORDER BY is_featured DESC, sort_order ASC, id DESC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    sku: row.sku,
    title: row.title,
    slug: row.slug,
    short_description: row.short_description || '',
    description: row.description || '',
    sale_price: toNumber(row.sale_price, 0),
    compare_price: row.compare_price === null ? null : toNumber(row.compare_price, 0),
    badge_text: row.badge_text || '',
    hero_gradient_from: row.hero_gradient_from || '#0f766e',
    hero_gradient_to: row.hero_gradient_to || '#2563eb',
    is_featured: Boolean(row.is_featured),
    sort_order: Number(row.sort_order || 0),
  }));
}

export default async function VpsPage() {
  const [user, products, settings] = await Promise.all([
    getCurrentUser(),
    listVpsProducts().catch(() => []),
    getLegacySettingsMap().catch(() => ({})),
  ]);

  const vpsSettings = settings as Record<string, string>;
  const externalUrl = process.env.INTEGRATED_VPS_SITE_URL || 'https://vps.trungtammmo.vn/';
  const normalizedExternalUrl = externalUrl.replace(/\/+$/, '');
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');
  const ctaUrl = normalizedExternalUrl.startsWith(normalizedSiteUrl) ? '/vps#vps-packages' : externalUrl;

  return (
    <AppShell user={user || undefined}>
      <div className="space-y-8 py-4">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:p-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-500">
                <Cloud className="h-3.5 w-3.5" />
                VPS / Cloud
              </div>
              <h1 className="text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white sm:text-4xl">
                Hosting & VPS tốc độ cao
              </h1>
              <p className="max-w-2xl text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                Khu vực VPS đã được mở lại trên Next app. Bạn có thể xem gói, tham khảo cấu hình và mở cổng tích hợp bên ngoài nếu hệ thống VPS đang được cấu hình.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href={ctaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white">
                  <Server className="h-4 w-4" />
                  Mở cổng VPS
                </Link>
                <Link href="/user/home" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                  <ArrowRight className="h-4 w-4" />
                  Về workspace
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { label: 'Trạng thái', value: String(vpsSettings.service_12_status || 'active') },
                { label: 'Tiêu đề', value: String(vpsSettings.service_12_name || 'VPS') },
                { label: 'Mô tả', value: String(vpsSettings.service_12_desc || 'Hosting & VPS tốc độ cao') },
                { label: 'Sản phẩm', value: `${products.length} gói` },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                  <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { icon: <Server className="h-5 w-5" />, title: 'VPS nhanh', body: 'Phù hợp chạy tool, bot, web app và các tác vụ vận hành.' },
            { icon: <Database className="h-5 w-5" />, title: 'Cấu hình rõ', body: 'Hiển thị CPU, RAM, Disk và giá bán ngay trên thẻ gói.' },
            { icon: <ShieldCheck className="h-5 w-5" />, title: 'Tích hợp an toàn', body: 'Khu vực bridge VPS tách biệt để bạn đổi sang hệ thống riêng khi cần.' },
          ].map((item) => (
            <div key={item.title} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">{item.icon}</div>
              <h2 className="mt-4 text-lg font-black uppercase text-slate-950 dark:text-white">{item.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">{item.body}</p>
            </div>
          ))}
        </section>

        <section id="vps-packages" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">Gói VPS nổi bật</h2>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{products.length} gói</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
              >
                <div
                  className="h-2"
                  style={{ background: `linear-gradient(90deg, ${product.hero_gradient_from}, ${product.hero_gradient_to})` }}
                />
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{product.sku}</div>
                      <h3 className="text-xl font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">{product.title}</h3>
                    </div>
                    {product.badge_text ? (
                      <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-brand-blue">
                        {product.badge_text}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                    {product.short_description || product.description || 'Gói VPS dành cho vận hành MMO và lưu trữ dịch vụ.'}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Giá bán</div>
                      <div className="mt-2 text-lg font-black text-emerald-500">
                        {new Intl.NumberFormat('vi-VN').format(product.sale_price)} đ
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">So sánh</div>
                      <div className="mt-2 text-lg font-black text-slate-950 dark:text-white">
                        {product.compare_price ? `${new Intl.NumberFormat('vi-VN').format(product.compare_price)} đ` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
