/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ALLOW_LOCAL_USER_FALLBACK?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_SITE_NAME?: string;
  readonly VITE_SITE_DESCRIPTION?: string;
  readonly VITE_TWITTER_HANDLE?: string;
  readonly VITE_MAIN_SITE_URL?: string;
  readonly VITE_DEPOSIT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
