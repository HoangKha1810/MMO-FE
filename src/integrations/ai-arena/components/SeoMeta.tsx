import { useEffect } from "react";
import {
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_IMAGE,
  SITE_LANGUAGE,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
  TWITTER_HANDLE,
  buildSeoTitle,
  toAbsoluteUrl
} from "../lib/seo";

interface SeoMetaProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  robots?: string;
}

const ensureMeta = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attrs).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
};

const ensureLink = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attrs).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
};

const ensureStructuredData = (payload: object[]) => {
  let script = document.head.querySelector<HTMLScriptElement>(
    'script[data-seo="structured-data"]'
  );

  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seo = "structured-data";
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": payload
    },
    null,
    2
  );
};

export function SeoMeta({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  image = SITE_IMAGE,
  type = "website",
  robots = "index,follow"
}: SeoMetaProps) {
  useEffect(() => {
    const canonicalUrl = toAbsoluteUrl(path);
    const fullTitle = buildSeoTitle(title);
    const absoluteImage = toAbsoluteUrl(image);

    document.documentElement.lang = "vi";
    document.title = fullTitle;

    ensureMeta('meta[name="description"]', {
      name: "description",
      content: description
    });
    ensureMeta('meta[name="keywords"]', {
      name: "keywords",
      content:
        "AI TTM, TrungTamMMO, chat AI, Gemini, OpenAI, Claude, Grok, so sánh AI, battle mode, direct chat"
    });
    ensureMeta('meta[name="author"]', {
      name: "author",
      content: SITE_AUTHOR
    });
    ensureMeta('meta[name="robots"]', { name: "robots", content: robots });
    ensureMeta('meta[name="googlebot"]', {
      name: "googlebot",
      content: `${robots},max-image-preview:large,max-snippet:-1,max-video-preview:-1`
    });
    ensureMeta('meta[name="application-name"]', {
      name: "application-name",
      content: SITE_NAME
    });
    ensureMeta('meta[property="og:locale"]', {
      property: "og:locale",
      content: SITE_LOCALE
    });
    ensureMeta('meta[property="og:type"]', {
      property: "og:type",
      content: type
    });
    ensureMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: SITE_NAME
    });
    ensureMeta('meta[property="og:title"]', {
      property: "og:title",
      content: fullTitle
    });
    ensureMeta('meta[property="og:description"]', {
      property: "og:description",
      content: description
    });
    ensureMeta('meta[property="og:url"]', {
      property: "og:url",
      content: canonicalUrl
    });
    ensureMeta('meta[property="og:image"]', {
      property: "og:image",
      content: absoluteImage
    });
    ensureMeta('meta[property="og:image:secure_url"]', {
      property: "og:image:secure_url",
      content: absoluteImage
    });
    ensureMeta('meta[property="og:image:type"]', {
      property: "og:image:type",
      content: "image/png"
    });
    ensureMeta('meta[property="og:image:alt"]', {
      property: "og:image:alt",
      content: fullTitle
    });
    ensureMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image"
    });
    ensureMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: fullTitle
    });
    ensureMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: description
    });
    ensureMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: absoluteImage
    });
    ensureMeta('meta[name="twitter:image:alt"]', {
      name: "twitter:image:alt",
      content: fullTitle
    });
    if (TWITTER_HANDLE) {
      ensureMeta('meta[name="twitter:site"]', {
        name: "twitter:site",
        content: TWITTER_HANDLE
      });
    }

    ensureLink('link[rel="canonical"]', {
      rel: "canonical",
      href: canonicalUrl
    });
    ensureLink('link[rel="alternate"][hreflang="vi-VN"]', {
      rel: "alternate",
      hreflang: SITE_LANGUAGE,
      href: canonicalUrl
    });
    ensureLink('link[rel="alternate"][hreflang="x-default"]', {
      rel: "alternate",
      hreflang: "x-default",
      href: canonicalUrl
    });

    ensureStructuredData([
      {
        "@type": "Organization",
        name: "TrungTamMMO",
        url: SITE_URL,
        logo: `${SITE_URL}/android-chrome-512x512.png`
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: SITE_LANGUAGE,
        description: SITE_DESCRIPTION,
        publisher: {
          "@type": "Organization",
          name: "TrungTamMMO"
        }
      },
      {
        "@type": "WebApplication",
        name: fullTitle,
        url: canonicalUrl,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: SITE_LANGUAGE,
        image: absoluteImage,
        description
      }
    ]);
  }, [description, image, path, robots, title, type]);

  return null;
}
