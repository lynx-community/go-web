import type { FrameworkPlatform } from './native-frameworks';
import { getFrameworkPlatform } from './native-frameworks';

/**
 * What the "open" surface should offer for a given bundle + viewer, derived
 * from the framework's platform affinity (see {@link getFrameworkPlatform}).
 *
 * QR and deep link are independent — a bundle can offer both, one, or neither:
 *
 * |                     | Desktop viewer      | Mobile viewer          |
 * | ------------------- | ------------------- | ---------------------- |
 * | universal           | QR + deep link      | QR + deep link         |
 * | desktop (lynxtron)  | deep link           | hint → open on desktop |
 * | mobile (sparkling)  | QR (scan to phone)  | QR + deep link         |
 */
export interface OpenInPlan {
  /** Show the QR panel (encodes the entry URL, or the deep link for a framework). */
  showQR: boolean;
  /** Show the deep-link "open here" affordance. */
  showDeepLink: boolean;
  /** When set, the bundle can't run here — show an "open on <platform>" hint. */
  hintPlatform: FrameworkPlatform | null;
}

export function resolveOpenIn(opts: {
  nativeFramework: string | undefined;
  isMobile: boolean;
  /** A deep link is available (framework default or explicit `deepLinkUrl`). */
  hasDeepLink: boolean;
  /** The entry has resolved, so there's something to encode / link to. */
  hasEntry: boolean;
}): OpenInPlan {
  const { nativeFramework, isMobile, hasDeepLink, hasEntry } = opts;
  const platform = getFrameworkPlatform(nativeFramework);
  const viewer: FrameworkPlatform = isMobile ? 'mobile' : 'desktop';

  // Universal — runs anywhere: QR (once an entry exists) plus a deep link when
  // one is configured.
  if (!platform) {
    return { showQR: hasEntry, showDeepLink: hasDeepLink, hintPlatform: null };
  }

  const runsHere = platform === viewer;
  const targetIsMobile = platform === 'mobile';

  if (runsHere) {
    // Open on this device; also offer QR when the target is a phone (scan onto
    // another device) — i.e. a mobile framework viewed on mobile.
    return {
      showQR: targetIsMobile && hasEntry,
      showDeepLink: hasDeepLink,
      hintPlatform: null,
    };
  }

  // Can't run on this device.
  if (targetIsMobile && viewer === 'desktop') {
    // Mobile framework on desktop → scan the QR to open it on a phone.
    return { showQR: hasEntry, showDeepLink: false, hintPlatform: null };
  }

  // Desktop framework on mobile → nothing runnable here; point to the desktop.
  return { showQR: false, showDeepLink: false, hintPlatform: platform };
}

/**
 * Whether the QR tab is ever appropriate for this framework, independent of the
 * viewer platform (and therefore synchronous — it depends only on
 * `nativeFramework`, not on the async entry/deep-link state). Used to gate the
 * QR tab's visibility and the redirect-away effect so a universal bundle never
 * transiently loses its QR tab before the entry loads.
 *
 * - universal → yes (both platforms)
 * - mobile framework (sparkling) → yes (desktop scans, mobile opens)
 * - desktop framework (lynxtron) → no (deep link on desktop, hint on mobile)
 */
export function isQrAllowed(nativeFramework: string | undefined): boolean {
  return getFrameworkPlatform(nativeFramework) !== 'desktop';
}
