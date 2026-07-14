export type OpenInVariant = 'tab' | 'bottom-sheet' | 'floating-toast' | 'none';

/**
 * Decide which "Open in ..." UI variant to render.
 *
 * - `nativeFramework === undefined`: bundle has no native runtime dependency
 *   and runs on any Lynx host. Show the full QR + deep-link tab flow.
 * - `nativeFramework` set (e.g. `"lynxtron"`, `"sparkling"`): bundle requires
 *   that specific host. Lynx Explorer scanning wouldn't work, so hide the QR
 *   tab entirely and only surface the deep link (floating on desktop,
 *   bottom-sheet on mobile).
 */
export function resolveOpenInVariant(opts: {
  nativeFramework: string | undefined;
  isMobile: boolean;
  hasDeepLink: boolean;
  hasEntry: boolean;
}): OpenInVariant {
  const { nativeFramework, isMobile, hasDeepLink, hasEntry } = opts;

  // Nothing to show
  if (!hasDeepLink && !hasEntry) return 'none';

  // Bundle requires a specific native framework → QR-to-Lynx-Explorer doesn't
  // apply. Only show the deep-link entry (floating on desktop, bottom-sheet on
  // mobile).
  if (nativeFramework) {
    return isMobile ? 'bottom-sheet' : 'floating-toast';
  }

  // Universal bundle (no native framework dep) → classic QR tab on both desktop
  // and mobile. Lynx Explorer scanning works everywhere, so there's no need for
  // the clipped bottom-sheet. Deep link, when configured, is appended inside it.
  return 'tab';
}
