export type OpenInVariant = 'tab' | 'bottom-sheet' | 'floating-toast' | 'none';

export function resolveOpenInVariant(opts: {
  bundleType: 'lynx' | 'lynxtron';
  isMobile: boolean;
  hasDeepLink: boolean;
  hasEntry: boolean;
}): OpenInVariant {
  const { bundleType, isMobile, hasDeepLink, hasEntry } = opts;

  // Nothing to show
  if (!hasDeepLink && !hasEntry) return 'none';

  if (bundleType === 'lynxtron') {
    if (isMobile) return 'bottom-sheet';
    return 'floating-toast';
  }

  // Lynx bundle
  if (isMobile) return 'bottom-sheet';
  return 'tab';
}
