/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_ANALYTICS_API_URL?: string;
  readonly VITE_PUBLIC_FINDER_EXPERIMENTAL_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __GRIDPULSE_BUILD_SHA__: string;
declare const __GRIDPULSE_BUILD_ENV__: string;
declare const __GRIDPULSE_PRODUCT_MODE__: string;

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
