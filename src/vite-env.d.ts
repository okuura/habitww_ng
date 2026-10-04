/// <reference types="vite/client" />

/** Injected at build time via vite.config.ts `define` */
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** iOS アプリ(habitww-ios)の WebView 内でのみ注入されるネイティブ API */
interface Window {
  HabitwwNative?: {
    platform: 'ios';
    openSettings: () => void;
    /** 古いアプリには無い */
    requestNotificationPermission?: () => void;
  };
}
