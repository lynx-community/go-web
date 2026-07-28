/**
 * Registry of known native frameworks and their platform affinity.
 *
 * A bundle's `nativeFramework` decides *where it can run*, which in turn decides
 * how the "open" surface behaves (see {@link resolveOpenIn}):
 *
 * - unset → **universal**: runs anywhere (Lynx Explorer). QR + deep link on
 *   both desktop and mobile.
 * - `platform: 'desktop'` (e.g. `lynxtron`): desktop host only. Deep link on
 *   desktop; on mobile there's nothing to run, so a "use desktop" hint.
 * - `platform: 'mobile'` (e.g. `sparkling`): mobile host only. Deep link on
 *   mobile; on desktop, a QR to scan the bundle onto a phone.
 */
export type FrameworkPlatform = 'desktop' | 'mobile';

/**
 * A URL that may differ per language, mirroring `GoConfig.explorerUrl`. A plain
 * string applies to every language.
 */
export type LocalizedUrl = string | { cn?: string; en?: string };

export function resolveLocalizedUrl(
  url: LocalizedUrl | undefined,
  lang: string,
): string | undefined {
  if (!url) return undefined;
  if (typeof url === 'string') return url;
  // Match on the primary subtag, the same normalization the `go.*` catalogs
  // use: a host handing us a BCP-47 tag like `zh-CN` / `zh-Hans` must not get
  // Chinese chrome text next to an English URL. `cn` isn't a language tag, but
  // it's the key name in `explorerUrl` / `LocalizedUrl`, so accept it too.
  const base = lang.toLowerCase().split(/[-_]/)[0];
  return base === 'zh' || base === 'cn' ? url.cn || url.en : url.en || url.cn;
}

export interface NativeFrameworkConfig {
  /** Platform the framework's host app runs on. */
  platform: FrameworkPlatform;
  /** Human-facing host app name, e.g. `"Lynxtron Go"`. */
  appName: string;
  /**
   * Default deep-link template for this framework. Supports `{{{url}}}` and
   * `{{{urlEncoded}}}`. The `deepLinkUrl` prop, when set, overrides it.
   */
  deepLinkScheme: string;
  /**
   * Docs / info URL shown when the bundle can't run on the current device
   * (e.g. a desktop framework opened on a phone). When set, the "can't run
   * here" hint becomes a link; otherwise it's plain text.
   *
   * Left unset here on purpose: the URL belongs to whoever hosts the docs, so
   * a site supplies it through `GoConfig.nativeFrameworks` rather than having
   * one site's domain baked into this package.
   */
  learnMoreUrl?: LocalizedUrl;
  /**
   * Where to get the host app. Deep links fail silently when the app isn't
   * installed, so the deep link is probed on click and — only if nothing
   * answers it — replaced by this URL. Not shown up front: a working deep link
   * should never carry a download prompt beside it. Same ownership rule as
   * `learnMoreUrl` — supplied per site.
   */
  downloadUrl?: LocalizedUrl;
}

/**
 * Per-site overrides for the registry below. `platform` is deliberately not
 * overridable — it's a fact about the framework, not a site preference, and
 * `resolveOpenIn` / `isQrAllowed` derive the whole open surface from it.
 */
export type NativeFrameworkOverride = Partial<
  Pick<
    NativeFrameworkConfig,
    'appName' | 'deepLinkScheme' | 'learnMoreUrl' | 'downloadUrl'
  >
>;

export type NativeFrameworkOverrides = Record<string, NativeFrameworkOverride>;

export const NATIVE_FRAMEWORKS: Record<string, NativeFrameworkConfig> = {
  lynxtron: {
    platform: 'desktop',
    appName: 'Lynxtron Go',
    deepLinkScheme: 'lynxtron-go://open?url={{{urlEncoded}}}',
  },
  sparkling: {
    platform: 'mobile',
    appName: 'Sparkling',
    deepLinkScheme: 'sparkling://open?url={{{urlEncoded}}}',
  },
};

/**
 * Registry entry for `nativeFramework`, merged with the site's overrides.
 * Overrides only apply to frameworks the registry knows — an unknown name has
 * no `platform` to reason about, so it keeps falling through to the
 * desktop-only default in {@link getFrameworkPlatform}.
 */
export function getFrameworkConfig(
  nativeFramework: string | undefined,
  overrides?: NativeFrameworkOverrides,
): NativeFrameworkConfig | undefined {
  if (!nativeFramework) return undefined;
  const base = NATIVE_FRAMEWORKS[nativeFramework];
  const override = overrides?.[nativeFramework];
  if (!base) return undefined;
  return override ? { ...base, ...override } : base;
}

/**
 * Platform a bundle targets: `null` = universal (runs anywhere). An unknown
 * `nativeFramework` string is treated as a desktop-only native (QR hidden,
 * needs an explicit `deepLinkUrl`) rather than silently falling back to
 * universal.
 */
export function getFrameworkPlatform(
  nativeFramework: string | undefined,
): FrameworkPlatform | null {
  if (!nativeFramework) return null;
  return getFrameworkConfig(nativeFramework)?.platform ?? 'desktop';
}
