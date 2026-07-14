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

export interface NativeFrameworkConfig {
  /** Platform the framework's host app runs on. */
  platform: FrameworkPlatform;
  /**
   * Default deep-link template for this framework. Supports `{{{url}}}` and
   * `{{{urlEncoded}}}`. The `deepLinkUrl` prop, when set, overrides it.
   */
  deepLinkScheme: string;
}

export const NATIVE_FRAMEWORKS: Record<string, NativeFrameworkConfig> = {
  lynxtron: {
    platform: 'desktop',
    deepLinkScheme: 'lynxtron-go://open?url={{{urlEncoded}}}',
  },
  sparkling: {
    platform: 'mobile',
    deepLinkScheme: 'sparkling://open?url={{{urlEncoded}}}',
  },
};

export function getFrameworkConfig(
  nativeFramework: string | undefined,
): NativeFrameworkConfig | undefined {
  if (!nativeFramework) return undefined;
  return NATIVE_FRAMEWORKS[nativeFramework];
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
