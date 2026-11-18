/**
 * Resolve a site-root URL through the host adapter. Relative URLs, external
 * URLs, protocol-relative URLs and schemes retain their original meaning.
 */
export function resolveSiteUrl(
  url: string,
  withBase?: (path: string) => string,
): string {
  return url.startsWith('/') && !url.startsWith('//') && withBase
    ? withBase(url)
    : url;
}
