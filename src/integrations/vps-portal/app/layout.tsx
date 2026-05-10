import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Lexend, Nunito_Sans } from "next/font/google";
import Script from "next/script";
import { DesktopInstallPrompt } from "@vps/components/layout/desktop-install-prompt";
import { ButtonLoadingGuard } from "@vps/components/ui/button-loading-guard";
import { ThemeProvider } from "@vps/components/ui/theme-provider";
import { WelcomeSplashHost } from "@vps/components/layout/welcome-splash-host";
import { PortalProvider } from "@vps/contexts/portal-context";
import { getAbsoluteUrl, siteConfig } from "@vps/lib/site";
import "./globals.css";

const headingFont = Be_Vietnam_Pro({
  variable: "--font-space-grotesk",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const bodyFont = Be_Vietnam_Pro({
  variable: "--font-dm-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const landingHeadingFont = Lexend({
  variable: "--font-landing-display",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const landingBodyFont = Nunito_Sans({
  variable: "--font-landing-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const metadataBase = new URL(siteConfig.siteUrl);
const bootstrapClientUiScript = `(() => {
  try {
    const storedTheme = window.localStorage.getItem("vncloud-vps-theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      document.documentElement.dataset.theme = storedTheme;
      document.documentElement.style.colorScheme = storedTheme;
    }
  } catch {}

  try {
    const shouldSkipSplash =
      new URLSearchParams(window.location.search).get("skip-splash") === "1";

    if (shouldSkipSplash) {
      window.sessionStorage.setItem("ttm_welcome_splash_done", "1");
    }

    if (shouldSkipSplash || window.sessionStorage.getItem("ttm_welcome_splash_done")) {
      document.documentElement.removeAttribute("data-welcome-splash");
    }
  } catch {}
})();`;
const criticalSplashStyles = `
  html[data-welcome-splash="show"] body [data-app-shell] {
    visibility: hidden;
    opacity: 0;
  }
  html[data-welcome-splash="show"] body #welcome-splash-prerender {
    opacity: 1;
    pointer-events: auto;
  }
  #welcome-splash-prerender {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    background: #08111d;
    opacity: 0;
    pointer-events: none;
  }
`;

export const metadata: Metadata = {
  metadataBase,
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  category: "technology",
  creator: siteConfig.creator,
  publisher: siteConfig.creator,
  alternates: {
    canonical: "/vps",
  },
  icons: {
    icon: [
      {
        url: siteConfig.favicon16Path,
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: siteConfig.favicon32Path,
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: siteConfig.icon192Path,
        sizes: "192x192",
        type: "image/png",
      },
    ],
    shortcut: [siteConfig.faviconPath],
    apple: [
      {
        url: siteConfig.appleTouchIconPath,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteConfig.siteUrl,
    title: siteConfig.title,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.openGraphImagePath,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.openGraphImagePath],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08111d" },
    { media: "(prefers-color-scheme: light)", color: "#f4f5ef" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: siteConfig.name,
        url: siteConfig.siteUrl,
        logo: getAbsoluteUrl(siteConfig.logoPath),
      },
      {
        "@type": "WebSite",
        name: siteConfig.title,
        url: siteConfig.siteUrl,
        description: siteConfig.description,
      },
    ],
  };

  return (
    <html
      lang="vi"
      suppressHydrationWarning
      data-theme="dark"
      data-scroll-behavior="smooth"
      data-welcome-splash="show"
      className={`${headingFont.variable} ${bodyFont.variable} ${landingHeadingFont.variable} ${landingBodyFont.variable} h-full antialiased`}
    >
      <head>
        <style
          dangerouslySetInnerHTML={{ __html: criticalSplashStyles }}
        />
      </head>
      <body className="min-h-full">
        <Script id="bootstrap-client-ui" strategy="beforeInteractive">
          {bootstrapClientUiScript}
        </Script>
        <div id="welcome-splash-prerender" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- prerender splash needs immediate HTML output */}
          <img
            src={siteConfig.splashLogoPath}
            alt={siteConfig.name}
            width={700}
            height={203}
            decoding="async"
            loading="eager"
            fetchPriority="high"
          />
          <p>{siteConfig.title}</p>
        </div>
        <Script
          id="site-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider>
          <PortalProvider>
            <div data-app-shell>{children}</div>
            <ButtonLoadingGuard />
            <DesktopInstallPrompt />
            <WelcomeSplashHost />
          </PortalProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
