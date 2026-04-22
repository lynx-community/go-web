import type { LynxViewElement as LynxView } from '@lynx-js/web-core/client';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadingOverlay } from './loading-overlay';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lynx-view': React.DetailedHTMLProps<LynxViewAttributes, HTMLElement>;
    }
  }
}

type LynxViewAttributes = React.HTMLAttributes<HTMLElement> & {
  'lynx-group-id'?: number;
  'transform-vh'?: boolean;
  'transform-vw'?: boolean;
};

interface WebIframeProps {
  show: boolean;
  src: string;
}

type CSSVarProperties = {
  [key: `--${string}`]: string | number;
};

// Container-relative unit hooks for Lynx runtime:
// - `containerType: 'size'` enables `cqw/cqh` units based on the host element box.
// - `--vh-unit/--vw-unit` make `vh/vw` behave like "container viewport" inside `<lynx-view>`.
// - `--rpx-unit` aligns `rpx` scaling with a 750-wide design baseline (mobile-like behavior).
// Note: web-core already applies `contain: content` internally; combined with `containerType: 'size'`
// this effectively behaves like `contain: strict` without us overriding containment explicitly.
const LYNX_VIEW_STYLE: React.CSSProperties & CSSVarProperties = {
  width: '100%',
  height: '100%',
  containerType: 'size',
  '--rpx-unit': 'calc(100cqw / 750)',
  '--vh-unit': '1cqh',
  '--vw-unit': '1cqw',
};

const MEASURE_CONTAINER: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

const INNER_VISIBLE: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  alignItems: 'center',
  justifyContent: 'center',
};

const INNER_HIDDEN: React.CSSProperties = {
  display: 'none',
};

// Use a shared group so multiple Lynx views can reuse web workers.
const LYNX_GROUP_ID = 42;

// Shared promise so multiple WebIframe instances don't duplicate the dynamic import
let runtimeReady: Promise<void> | null = null;
function ensureRuntime() {
  if (!runtimeReady) {
    runtimeReady = import('@lynx-js/web-core/client').then(() => {
      /* runtime loaded */
    });
  }
  return runtimeReady;
}

// Pre-compiled regex for webpack public path rewriting in customTemplateLoader
// Matches .p=\"<anything>\" — handles empty, single-char, and multi-char paths
const WEBPACK_PUBLIC_PATH_RE = /\.p=\\"[^"]*\\"/g;

// DEV: ?simulateError=runtime|template|shadow|render
const simulateError =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('simulateError')
    : null;

export const WebIframe = ({ show, src }: WebIframeProps) => {
  const lynxViewRef = useRef<LynxView>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [dimsReady, setDimsReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderedRef = useRef(false);
  const lastUrlRef = useRef<string>('');

  // Reset state when src changes
  useEffect(() => {
    setRendered(false);
    setError(null);
    renderedRef.current = false;
    lastUrlRef.current = '';
  }, [src]);

  // Load web-core eagerly on mount
  useEffect(() => {
    const t = performance.now();
    if (simulateError === 'runtime') {
      setError('Failed to load Lynx runtime: simulated error');
      return;
    }
    ensureRuntime()
      .then(() => {
        console.log(
          '[WebIframe] runtime ready',
          `${(performance.now() - t).toFixed(0)}ms`,
        );
        setReady(true);
      })
      .catch((err) => {
        console.error('[WebIframe] runtime load failed', err);
        setError(
          `Failed to load Lynx runtime: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }, []);

  // Set lynx-view dimensions to match the container.
  // Called on initial setup, SystemInfo cannot be updated after that.
  const setDimensions = useCallback((): boolean => {
    if (!lynxViewRef.current || !containerRef.current) return false;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width === 0 || height === 0) return false;

    const pixelRatio = window.devicePixelRatio;
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);

    // @ts-ignore
    lynxViewRef.current.browserConfig = {
      pixelWidth,
      pixelHeight,
      pixelRatio,
    };
    return true;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setDimsReady(el.clientWidth > 0 && el.clientHeight > 0);
    };
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Set URL eagerly once runtime is ready and element is mounted.
  // No longer gates on `show` — content is preloaded so tab switches are instant.
  // `lastUrlRef` prevents redundant url assignments that could trigger reloads.
  useEffect(() => {
    if (
      ready &&
      dimsReady &&
      src &&
      lynxViewRef.current &&
      containerRef.current
    ) {
      // Skip URL assignment only, not the rest of initialization
      const urlAlreadySet = lastUrlRef.current === src;

      const t0 = performance.now();
      const tag = `[WebIframe ${src.split('/').pop()}]`;
      console.log(tag, 'effect start', { ready, src, urlAlreadySet });

      const initialized = setDimensions();
      if (!initialized) return;

      if (!urlAlreadySet) {
        // @ts-ignore
        lynxViewRef.current.customTemplateLoader = async (url: string) => {
          try {
            if (simulateError === 'template') {
              throw new Error('simulated template load error');
            }
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status} loading ${url}`);
            }
            const text = await res.text();

            // Rewrite webpack's public path in the bundle JS so that asset
            // URLs (images etc.) resolve relative to the bundle location,
            // not the page URL.
            const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
            const rewritten = text.replace(
              WEBPACK_PUBLIC_PATH_RE,
              `.p=\\"${baseUrl}\\"`,
            );
            const template = JSON.parse(rewritten);

            // Workaround: when no template modules reference publicPath (no asset
            // imports), rspack omits the local webpack runtime from lepusCode and
            // emits a bare `__webpack_require__` reference. Inject a minimal shim
            // so the entry-point executor (`__webpack_require__.x`) can run.
            if (template.lepusCode?.root) {
              const root = template.lepusCode.root;
              if (
                typeof root === 'string' &&
                root.includes('__webpack_require__') &&
                !root.includes('function __webpack_require__')
              ) {
                template.lepusCode.root =
                  `var __webpack_require__={p:"${baseUrl}"};` + root;
              }
            }

            return template;
          } catch (err) {
            console.error(tag, 'template load failed', err);
            setError(
              `Failed to load template: ${err instanceof Error ? err.message : String(err)}`,
            );
            throw err;
          }
        };

        console.log(
          tag,
          'url set',
          `+${(performance.now() - t0).toFixed(0)}ms`,
        );
        lynxViewRef.current.url = src;
        lastUrlRef.current = src;
      }

      // Workaround: web-core reads MouseEvent.x/.y (viewport-relative) for
      // tap event detail.x/.y. When the <lynx-view> is embedded at a non-zero
      // offset, coordinates are wrong. Override the coordinate getters on the
      // original event in a capture-phase listener (before web-core reads
      // them on the element's bubbling handler).
      const el = lynxViewRef.current as unknown as HTMLElement;
      let disposed = false;
      let mo: MutationObserver | undefined;
      let removeClickFix: (() => void) | undefined;

      const adjustClickCoords = (e: Event) => {
        const me = e as MouseEvent;
        const rect = el.getBoundingClientRect();
        const adjustedX = me.clientX - rect.left;
        const adjustedY = me.clientY - rect.top;
        Object.defineProperties(me, {
          clientX: { get: () => adjustedX },
          clientY: { get: () => adjustedY },
          x: { get: () => adjustedX },
          y: { get: () => adjustedY },
          pageX: { get: () => adjustedX },
          pageY: { get: () => adjustedY },
        });
      };

      // The shadow root is created asynchronously by web-core after url is
      // set, so we poll until it becomes available before attaching observers.
      const markRendered = (source: string) => {
        if (renderedRef.current) return;
        if (simulateError === 'render') return; // simulate render timeout
        console.log(
          tag,
          `rendered (${source})`,
          `+${(performance.now() - t0).toFixed(0)}ms`,
        );
        renderedRef.current = true;
        setRendered(true);
      };

      const setupShadow = (shadow: ShadowRoot) => {
        console.log(
          tag,
          'shadow found',
          `+${(performance.now() - t0).toFixed(0)}ms`,
          {
            childElementCount: shadow.childElementCount,
          },
        );

        // If shadow already has children when we attach, we missed the mutation
        if (shadow.childElementCount > 0) {
          markRendered('immediate');
        } else {
          mo = new MutationObserver(() => {
            if (shadow.childElementCount > 0) {
              markRendered('observer');
              mo!.disconnect();
            }
          });
          mo.observe(shadow, { childList: true, subtree: true });
        }

        shadow.addEventListener('click', adjustClickCoords, true);
        removeClickFix = () =>
          shadow.removeEventListener('click', adjustClickCoords, true);
      };

      if (simulateError === 'shadow') {
        setTimeout(
          () =>
            setError(
              'Preview timed out: shadow root was not created (simulated)',
            ),
          500,
        );
        return () => {};
      }

      let timer: ReturnType<typeof setTimeout> | undefined;

      if (!renderedRef.current) {
        const pollStart = performance.now();
        const pollShadow = () => {
          if (disposed) return;
          if (performance.now() - pollStart > 3000) {
            console.error(tag, 'shadow root timeout');
            setError('Preview timed out: shadow root was not created');
            return;
          }
          const shadow = el.shadowRoot;
          if (shadow) {
            setupShadow(shadow);
          } else {
            requestAnimationFrame(pollShadow);
          }
        };
        pollShadow();

        // Fallback: error if rendering doesn't complete within 5s
        timer = setTimeout(() => {
          if (!renderedRef.current) {
            console.error(
              tag,
              'render timeout',
              `+${(performance.now() - t0).toFixed(0)}ms`,
            );
            setError('Preview timed out: rendering did not complete within 5s');
          }
        }, 5000);
      } else {
        const shadow = el.shadowRoot;
        if (shadow) {
          shadow.addEventListener('click', adjustClickCoords, true);
          removeClickFix = () =>
            shadow.removeEventListener('click', adjustClickCoords, true);
        }
      }

      return () => {
        disposed = true;
        if (timer) clearTimeout(timer);
        mo?.disconnect();
        removeClickFix?.();
      };
    }
  }, [ready, dimsReady, src, setDimensions]);

  // Only show loading state when the view is actually visible
  const loading = show && (!ready || !rendered || !!error);

  // Always mount <lynx-view> when src exists so the ref
  // is always populated and shadow DOM persists
  // across tab switches.
  return (
    // Outer: always in layout for dimension measurement
    // Inner: controls visibility
    <div style={MEASURE_CONTAINER} ref={containerRef}>
      <div style={show ? INNER_VISIBLE : INNER_HIDDEN}>
        <LoadingOverlay visible={loading} error={error} />
        {src && (
          <lynx-view
            key={src}
            ref={lynxViewRef}
            style={LYNX_VIEW_STYLE}
            lynx-group-id={LYNX_GROUP_ID}
            transform-vh={true}
            transform-vw={true}
          />
        )}
      </div>
    </div>
  );
};
