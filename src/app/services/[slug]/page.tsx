import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { buildAbsoluteUrl, siteName } from '@/lib/seo';
import { getServiceSeoEntry, serviceSeoEntries } from '@/lib/service-seo';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return serviceSeoEntries.map((service) => ({
    slug: service.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceSeoEntry(slug);

  if (!service) {
    return {};
  }

  const canonical = `/services/${service.slug}`;

  return {
    title: service.title,
    description: service.description,
    keywords: service.keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      locale: 'vi_VN',
      siteName,
      url: buildAbsoluteUrl(canonical),
      title: service.title,
      description: service.description,
      images: [
        {
          url: buildAbsoluteUrl('/opengraph-image'),
          width: 1200,
          height: 630,
          alt: `${service.shortTitle} - ${siteName}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: service.title,
      description: service.description,
      images: [buildAbsoluteUrl('/twitter-image')],
    },
  };
}

export default async function ServiceSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const service = getServiceSeoEntry(slug);

  if (!service) {
    notFound();
  }

  return (
    <main className="mmo-board service-seo-page min-h-screen overflow-hidden">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-10">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          <Link href="/" className="transition hover:text-brand-blue dark:hover:text-white">
            Trang chủ
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-600" />
          <span>Dịch vụ</span>
          <ChevronRight className="h-4 w-4 text-slate-600" />
          <span className="text-slate-950 dark:text-white">{service.shortTitle}</span>
        </nav>

        <div className="grid flex-1 items-center gap-8 py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-8">
            <div className="surface-chip inline-flex items-center gap-3 rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.28em] text-brand-blue">
              <Sparkles className="h-4 w-4 text-blue-400" />
              {service.eyebrow}
            </div>

            <div className="space-y-6">
              <h1 className="max-w-5xl text-5xl font-black uppercase leading-[0.95] tracking-[-0.06em] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                {service.title}
              </h1>
              <p className="max-w-3xl text-lg font-semibold leading-9 text-slate-600 dark:text-slate-300 sm:text-xl">
                {service.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={service.ctaHref}
                className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 px-7 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-blue-700/25 transition hover:-translate-y-0.5 hover:shadow-cyan-500/30"
              >
                {service.ctaLabel}
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>
              <Link
                href="/"
                className="ghost-button inline-flex items-center gap-3 rounded-full px-7 py-4 text-sm font-black uppercase tracking-[0.2em]"
              >
                Xem nền tảng
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {service.highlights.map((highlight) => (
                <div key={highlight} className="surface-card rounded-[1.5rem] p-5">
                  <CheckCircle2 className="mb-4 h-5 w-5 text-emerald-400" />
                  <div className="text-sm font-extrabold leading-6 text-slate-800 dark:text-slate-100">{highlight}</div>
                </div>
              ))}
            </div>
          </div>

          <aside className="surface-panel rounded-[2rem] p-6">
            <div className="rounded-[1.5rem] border border-blue-400/20 bg-blue-500/10 p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-brand-blue">Ứng dụng thực tế</div>
              <div className="mt-5 grid gap-3">
                {service.useCases.map((item, index) => (
                  <div key={item} className="surface-card rounded-2xl p-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-blue-300">
                      0{index + 1}
                    </div>
                    <div className="text-base font-extrabold leading-7 text-slate-950 dark:text-white">{item}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card mt-5 rounded-[1.5rem] p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Từ khóa SEO</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {service.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="surface-chip rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-200"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-white/60 px-5 py-16 dark:border-white/10 dark:bg-[#030712] sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">FAQ</div>
            <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
              Câu hỏi thường gặp về {service.shortTitle}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {service.faqs.map((faq) => (
              <article key={faq.question} className="surface-card rounded-[1.5rem] p-6">
                <h3 className="text-lg font-black text-slate-950 dark:text-white">{faq.question}</h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
