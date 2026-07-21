import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ExamplePreviewProps } from './example-preview';
import { useIsClient } from './example-preview/hooks/use-is-client';

export type PreviewTab = 'preview' | 'web' | 'qrcode';

/**
 * What to show while the Web preview loads its runtime / bundle.
 *
 * - `'overlay'` — built-in spinner overlay inside the Web panel (default)
 * - `'preview'` — keep the Preview image/video visible until `<lynx-view>` has
 *   painted, then reveal the live Web tab. Falls back to `'overlay'` when no
 *   preview image is available. Soft refresh always uses the spinner overlay.
 */
export type WebLoadingScreen = 'overlay' | 'preview';

/** Known `go.*` chrome keys owned by this package. */
export type GoI18nKey =
  | 'go.preview'
  | 'go.qrcode'
  | 'go.files'
  | 'go.scan.message-1'
  | 'go.scan.message-2'
  | 'go.qrcode.copy-link'
  | 'go.qrcode.copied'
  | 'go.qrcode.entry'
  | 'go.openin'
  | 'go.deeplink.open.default'
  | 'go.deeplink.open.lynxtron'
  | 'go.deeplink.open.sparkling'
  | 'go.deeplink.hint-desktop'
  | 'go.deeplink.hint-mobile'
  | 'go.deeplink.or'
  | 'go.openin.show-qrcode'
  | 'go.ultra'
  | 'go.ultra.exit'
  | 'go.refresh';

export type GoI18nCatalog = Record<GoI18nKey, string>;

/**
 * Partial overrides for package-owned chrome strings (never via host i18n hooks).
 * Also accepts `go.deeplink.open.{nativeFramework}` for custom frameworks.
 */
export type GoI18nOverrides = Partial<
  Record<GoI18nKey | `go.deeplink.open.${string}`, string>
>;

const GO_I18N_EN: GoI18nCatalog = {
  'go.preview': 'Preview',
  'go.qrcode': 'QR Code',
  'go.files': 'Files',
  'go.scan.message-1': 'Scan the QR code with',
  'go.scan.message-2': 'to preview on device.',
  'go.qrcode.copy-link': 'Copy link',
  'go.qrcode.copied': 'Copied!',
  'go.qrcode.entry': 'Entry:',
  'go.openin': 'Open',
  // Deep-link button label. Key is suffixed by `nativeFramework` (from
  // metadata or prop); `.default` is used when no native framework is
  // required (universal bundle, opens in Lynx Explorer).
  'go.deeplink.open.default': 'Open in Lynx Explorer',
  'go.deeplink.open.lynxtron': 'Open in Lynxtron Go',
  'go.deeplink.open.sparkling': 'Open in Sparkling',
  'go.deeplink.hint-desktop': 'desktop only',
  'go.deeplink.hint-mobile': 'mobile only',
  'go.deeplink.or': 'or',
  'go.openin.show-qrcode': 'Show QR Code',
  'go.ultra': 'Open frameless',
  'go.ultra.exit': 'Exit frameless',
  'go.refresh': 'Refresh',
};

const GO_I18N_ZH: GoI18nCatalog = {
  'go.preview': '预览',
  'go.qrcode': '二维码',
  'go.files': '文件',
  'go.scan.message-1': '请下载 ',
  'go.scan.message-2': '扫描二维码预览',
  'go.qrcode.copy-link': '复制链接',
  'go.qrcode.copied': '已复制',
  'go.qrcode.entry': '入口',
  'go.openin': '打开',
  'go.deeplink.open.default': '在 Lynx Explorer 中打开',
  'go.deeplink.open.lynxtron': '在 Lynxtron Go 中打开',
  'go.deeplink.open.sparkling': '在 Sparkling 中打开',
  'go.deeplink.hint-desktop': '仅桌面',
  'go.deeplink.hint-mobile': '仅移动端',
  'go.deeplink.or': '或',
  'go.openin.show-qrcode': '显示二维码',
  'go.ultra': '打开无边框',
  'go.ultra.exit': '退出无边框',
  'go.refresh': '刷新',
};

const BUILTIN_I18N: Record<'en' | 'zh', GoI18nCatalog> = {
  en: GO_I18N_EN,
  zh: GO_I18N_ZH,
};

/** @deprecated Use {@link GO_I18N_EN}. Kept for existing imports. */
const DEFAULT_I18N: Record<string, string> = GO_I18N_EN;

function resolveBuiltinLang(lang: string): 'en' | 'zh' {
  const base = lang.toLowerCase().split(/[-_]/)[0] ?? 'en';
  return base === 'zh' ? 'zh' : 'en';
}

/**
 * Resolve a `go.*` chrome string from package catalogs.
 * Order: config `i18n` override → builtin for `lang` → English → raw key.
 * Host site i18n systems (Rspress, etc.) are intentionally not consulted.
 */
export function translateGoI18n(
  key: string,
  lang: string = 'en',
  overrides?: GoI18nOverrides,
): string {
  const fromOverride = overrides?.[key as keyof GoI18nOverrides];
  if (typeof fromOverride === 'string') return fromOverride;

  const builtin = BUILTIN_I18N[resolveBuiltinLang(lang)];
  return builtin[key as GoI18nKey] ?? GO_I18N_EN[key as GoI18nKey] ?? key;
}

/** Default CodeBlock — plain <pre><code> with no syntax highlighting. */
const DefaultCodeBlock = ({
  code,
  onRendered,
}: {
  code: string;
  lang: string;
  onRendered?: () => void;
  shikiOptions?: Record<string, unknown>;
}) => {
  useEffect(() => {
    onRendered?.();
  }, [code, onRendered]);
  return (
    <pre>
      <code>{code}</code>
    </pre>
  );
};

/** Default NoSSR — renders children only in browser. */
const DefaultNoSSR = ({ children }: { children: React.ReactNode }) => {
  const isClient = useIsClient();
  return isClient ? <>{children}</> : null;
};

/** Default useDark — tracks prefers-color-scheme media query. */
function defaultUseDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

export interface GoConfig {
  /** Base path for examples, e.g. '/lynx-examples' or '/examples' */
  exampleBasePath: string;
  /**
   * Default preview tab. Applies to all `<Go>` instances under this provider
   * unless overridden by the `defaultTab` prop on individual instances.
   */
  defaultTab?: PreviewTab;
  /**
   * Default Web-tab loading screen. Applies to all `<Go>` instances under this
   * provider unless overridden by the `webLoadingScreen` prop on instances.
   *
   * When omitted, each instance auto-selects `'preview'` if its `defaultTab`
   * is `'web'` and a preview image exists; otherwise `'overlay'`.
   */
  webLoadingScreen?: WebLoadingScreen;
  /** Explorer URLs for QR code scanning instructions */
  explorerUrl?: {
    cn?: string;
    en?: string;
  };
  /** Explorer app name, defaults to 'Lynx Explorer' */
  explorerText?: string;
  /** Custom error component for failed example loading */
  ErrorComponent?: React.ComponentType<{
    example: string;
    exampleBaseUrl: string;
  }>;
  /** SSG rendering component, used when import.meta.env.SSG_MD is true */
  SSGComponent?: React.ComponentType<ExamplePreviewProps>;
  /** Custom loading overlay component */
  LoadingComponent?: React.ComponentType<{ visible: boolean }>;
  /** Absolute disk path to examples directory, for built-in SSG component */
  ssgExampleRoot?: string;

  /**
   * Optional overrides for package-owned `go.*` chrome strings.
   * Prefer this over host i18n systems — `<Go>` never calls Rspress/site `useI18n`.
   */
  i18n?: GoI18nOverrides;

  // --- Framework adapter ---

  /** Prepend site base path to URLs. Default: identity */
  withBase?: (path: string) => string;
  /** Language detection hook. Default: () => 'en'. Selects builtin en/zh catalogs. */
  useLang?: () => string;
  /** Dark mode detection hook. Default: prefers-color-scheme media query */
  useDark?: () => boolean;
  /** Wrapper to suppress SSR rendering. Default: typeof window guard */
  NoSSR?: React.ComponentType<{ children: React.ReactNode }>;
  /** Syntax-highlighted code block component. Default: plain <pre><code> */
  CodeBlock?: React.ComponentType<{
    code: string;
    lang: string;
    onRendered?: () => void;
    shikiOptions?: Record<string, unknown>;
  }>;
}

const defaultConfig: GoConfig = {
  exampleBasePath: '/lynx-examples',
};

const GoConfigContext = createContext<GoConfig>(defaultConfig);

export function GoConfigProvider({
  config,
  children,
}: {
  config: GoConfig;
  children: React.ReactNode;
}) {
  return (
    <GoConfigContext.Provider value={config}>
      {children}
    </GoConfigContext.Provider>
  );
}

export function useGoConfig(): GoConfig {
  return useContext(GoConfigContext);
}

// Re-export defaults for use in components
export {
  BUILTIN_I18N,
  DEFAULT_I18N,
  DefaultCodeBlock,
  DefaultNoSSR,
  defaultUseDark,
  GO_I18N_EN,
  GO_I18N_ZH,
};
