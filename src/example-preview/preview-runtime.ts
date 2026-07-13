/**
 * Level B — pluggable preview runtime.
 *
 * The built-in web preview renders exactly ONE `<lynx-view>` (see
 * `components/web-iframe.tsx`), which cannot demonstrate multi-page (MPA)
 * examples: cross-page navigation has no second card to navigate to.
 *
 * A `PreviewRuntime` lets an embedder REPLACE just the inner card renderer so it
 * can stack multiple `<lynx-view>` cards and route navigation between them,
 * while go-web keeps owning the tab bar, QR, code browser, fit/scaling, and the
 * SSG path. The runtime receives every previewable entry plus the resolved
 * Level-A native environment.
 *
 * ── Two usage shapes, one hook ──────────────────────────────────────────────
 * This single component slot supports BOTH designs discussed for MPA:
 *
 *   B1) In-process card stack. The runtime keeps a stack of `<lynx-view>`
 *       elements in React state and pushes/pops on native navigation calls
 *       (`router.open` / `back`). Navigation state lives in the component, so no
 *       `window.history` pollution and the first card's heap stays intact.
 *
 *   B2) Iframe runtime. The runtime renders a real
 *       `<iframe src={embedderRuntimeUrl}>` and passes `entries` via the query
 *       string / `postMessage`. Because an iframe is a real nested browsing
 *       context, `window.history` and navigation are naturally scoped to it —
 *       the web's native "separate document" model. This is ideal for embedders
 *       (e.g. a full-page "web shell") that already assemble stacked lynx-views
 *       + native bridge + globalProps and want to plug that page in as-is.
 *
 * go-web recommends B1 as the default (no cross-origin handshake, type-safe
 * composition, reuses go-web scaling) and treats B2 as an escape hatch that is
 * trivially expressible as a `PreviewRuntime` that renders an `<iframe>`.
 */
import type { ComponentType } from 'react';
import type { PreviewNativeEnv } from './preview-native-env';
import type { WebPreviewMode } from './utils/resolve-web-preview';

/** A single previewable entry (an example bundle with a web build). */
export interface PreviewRuntimeEntry {
  /** Entry name (`templateFiles[].name` from example-metadata.json). */
  name: string;
  /** Absolute URL of the web bundle for this entry. */
  webUrl: string;
  /** Source bundle path relative to the example root (`templateFiles[].file`). */
  file: string;
}

/**
 * Props passed to a custom `PreviewRuntime`. go-web resolves all example data,
 * scaling parameters, and the native environment, then hands them over. A
 * runtime is only responsible for rendering (and, for MPA, routing between)
 * `<lynx-view>` cards inside the box go-web gives it.
 */
export interface PreviewRuntimeProps {
  /** Example folder name (under `exampleBasePath`). */
  example: string;
  /** Base URL where this example's assets live. */
  exampleBaseUrl: string;
  /** Every previewable entry (those with a `webFile`), in metadata order. */
  entries: PreviewRuntimeEntry[];
  /** Currently active entry name (driven by the entry selector). */
  activeEntry: string;
  /**
   * Web bundle URL of the active entry — the same URL the built-in single-card
   * preview would render. Convenience for runtimes that only need the root card.
   */
  src: string;
  /** Whether the Web preview tab is currently visible. */
  show: boolean;
  /** Resolved Level-A native environment (may be `undefined`). */
  nativeEnv?: PreviewNativeEnv;

  // ── Scaling / fit parameters, forwarded so runtimes can match go-web ──
  webPreviewMode: WebPreviewMode;
  designWidth: number;
  designHeight: number;
  fitThresholdScale: number;
  fitMinScale: number;
  fit: 'contain' | 'cover' | 'auto';
}

/** A custom preview runtime component (the `GoConfig.PreviewRuntime` slot). */
export type PreviewRuntimeComponent = ComponentType<PreviewRuntimeProps>;
