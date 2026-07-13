/**
 * Demo-only mapping from a native-module call to a card-stack navigation intent.
 *
 * This encodes the EMBEDDER's convention — go-web itself stays product-agnostic
 * and knows none of this. Here the demo treats a native call named `open` as
 * "push a card" and `back` as "pop a card". `open` carries either an `entry`
 * name or a `url` identifying the target bundle; we resolve it against the
 * example's previewable entries.
 *
 * A real integration (e.g. a vue-router example whose `router.open` stacks
 * native containers) would parse its own schema here instead.
 */
import type { PreviewRuntimeEntry } from '../../../src/example-preview/preview-runtime';

export type NavIntent =
  | { type: 'back' }
  | { type: 'push'; entry: PreviewRuntimeEntry };

/** Names this demo treats as navigation (case-insensitive). */
const OPEN_METHODS = new Set(['open', 'push', 'navigate', 'openpage']);
const BACK_METHODS = new Set(['back', 'pop', 'goback', 'close']);

/**
 * Resolve a native call into a navigation intent, or `null` if the call is not
 * navigation (and should be delegated to the embedder's own handler).
 */
export function resolveDemoNavIntent(
  name: string,
  data: unknown,
  entries: PreviewRuntimeEntry[],
): NavIntent | null {
  const method = String(name).toLowerCase();
  if (BACK_METHODS.has(method)) {
    return { type: 'back' };
  }
  if (OPEN_METHODS.has(method)) {
    const target = findTarget(data, entries);
    if (target) return { type: 'push', entry: target };
  }
  return null;
}

function findTarget(
  data: unknown,
  entries: PreviewRuntimeEntry[],
): PreviewRuntimeEntry | undefined {
  const payload = normalizePayload(data);
  if (payload.entry) {
    const byName = entries.find((e) => e.name === payload.entry);
    if (byName) return byName;
  }
  if (payload.url) {
    const byUrl = entries.find(
      (e) => e.webUrl === payload.url || e.file === payload.url,
    );
    if (byUrl) return byUrl;
  }
  // Fall back to the next entry after the first, so the demo can advance even
  // without a precise target — enough to show a second card opening.
  return entries[1];
}

function normalizePayload(data: unknown): { entry?: string; url?: string } {
  if (typeof data === 'string') return { url: data };
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const entry = typeof obj.entry === 'string' ? obj.entry : undefined;
    const url =
      typeof obj.url === 'string'
        ? obj.url
        : typeof obj.schema === 'string'
          ? obj.schema
          : undefined;
    return { entry, url };
  }
  return {};
}
