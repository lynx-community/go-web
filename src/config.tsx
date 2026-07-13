import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ExamplePreviewProps } from './example-preview';
import type { PreviewNativeEnv } from './example-preview/preview-native-env';
import type { PreviewRuntimeComponent } from './example-preview/preview-runtime';
import { useIsClient } from './example-preview/hooks/use-is-client';

export type PreviewTab = 'preview' | 'web' | 'qrcode';

/** Built-in English i18n strings. Consumers can override via useI18n. */
const DEFAULT_I18N: Record<string, string> = {
  'go.preview': 'Preview',
  'go.qrcode': 'QR Code',
  'go.files': 'Files',
  'go.scan.message-1': 'Scan the QR code with',
  'go.scan.message-2': 'to preview on device.',
  'go.qrcode.copy-link': 'Copy link',
  'go.qrcode.copied': 'Copied!',
  'go.qrcode.entry': 'Entry:',
};

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

  // --- Live preview extension points (opt-in) ---

  /**
   * Level A — native environment forwarded to the previewed `<lynx-view>`.
   *
   * Site-wide defaults for registering a native-modules bridge, injecting
   * per-card `globalProps`/`initData`, and handling native-module calls made by
   * the previewed bundle. Per-instance `nativeEnv` on `<Go>` is shallow-merged
   * over this. Unset ⇒ preview behavior is unchanged.
   */
  previewNativeEnv?: PreviewNativeEnv;

  /**
   * Level B — replace the built-in single-card web preview renderer.
   *
   * When provided, go-web renders this component in place of the default
   * `<lynx-view>` card (still inside go-web's tab bar / QR / code browser /
   * scaling), passing every previewable entry plus the resolved native
   * environment. Use it to stack cards and route cross-page (MPA) navigation.
   * Unset ⇒ the built-in single-card preview is used.
   */
  PreviewRuntime?: PreviewRuntimeComponent;

  // --- Framework adapter ---

  /** Prepend site base path to URLs. Default: identity */
  withBase?: (path: string) => string;
  /** i18n hook returning a translation function. Default: built-in English strings */
  useI18n?: () => (key: string) => string;
  /** Language detection hook. Default: () => 'en' */
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
export { DEFAULT_I18N, DefaultCodeBlock, DefaultNoSSR, defaultUseDark };
