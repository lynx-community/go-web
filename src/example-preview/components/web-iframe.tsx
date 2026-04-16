import type { LynxViewElement as LynxView } from '@lynx-js/web-core/client';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadingOverlay } from './loading-overlay';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lynx-view': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

interface WebIframeProps {
  show: boolean;
  src: string;
}

type CSSVarProperties = {
  [key: `--${string}`]: string | number;
};

const LYNX_VIEW_STYLE: React.CSSProperties & CSSVarProperties = {
  width: '100%',
  height: '100%',
  contain: 'strict',
  containerType: 'size',
  '--rpx-unit': 'calc(100cqw / 750)',
  '--vh-unit': '1cqh',
  '--vw-unit': '1cqw',
};

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

/**
 * Rewrite CSS viewport units (vh/vw) in a Lynx template's styleInfo to use
 * CSS custom properties (--lynx-vh / --lynx-vw). This fixes viewport-unit
 * sizing inside the <lynx-view> shadow DOM, where native CSS vh/vw resolve
 * to the browser viewport rather than the preview container.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rewriteViewportUnits(template: any): void {
  if (!template.styleInfo) return;

  const rewrite = (value: string) =>
    value
      .replace(/(-?\d+\.?\d*)vh/g, (_, num) => {
        const n = Number.parseFloat(num);
        if (n === 100) return 'var(--lynx-vh, 100vh)';
        return `calc(var(--lynx-vh, 100vh) * ${n / 100})`;
      })
      .replace(/(-?\d+\.?\d*)vw/g, (_, num) => {
        const n = Number.parseFloat(num);
        if (n === 100) return 'var(--lynx-vw, 100vw)';
        return `calc(var(--lynx-vw, 100vw) * ${n / 100})`;
      });

  for (const key of Object.keys(template.styleInfo)) {
    const info = template.styleInfo[key];
    if (info.content) {
      info.content = info.content.map((s: string) => rewrite(s));
    }
    if (info.rules) {
      for (const rule of info.rules) {
        if (rule.decl) {
          rule.decl = rule.decl.map(([prop, val]: [string, string]) => [
            prop,
            rewrite(val),
          ]);
        }
      }
    }
  }
}

// DEV: ?simulateError=runtime|template|shadow|render
const simulateError =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('simulateError')
    : null;

export const WebIframe = ({ show, src }: WebIframeProps) => {
  const lynxViewRef = useRef<LynxView>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderedRef = useRef(false);

  // Reset state when src changes
  useEffect(() => {
    setRendered(false);
    setError(null);
    renderedRef.current = false;
  }, [src]);

  // Load web-core + web-elements eagerly on mount
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

  // Update lynx-view dimensions to match the container.
  // Called on initial setup and on container resize.
  const updateDimensions = useCallback(() => {
    if (!lynxViewRef.current || !containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    // @ts-ignore
    lynxViewRef.current.browserConfig = {
      pixelWidth: Math.round(w * window.devicePixelRatio),
      pixelHeight: Math.round(h * window.devicePixelRatio),
    };
  }, []);

  // Set URL only after runtime is ready AND element is mounted
  useEffect(() => {
    if (ready && show && src && lynxViewRef.current && containerRef.current) {
      const t0 = performance.now();
      const tag = `[WebIframe ${src.split('/').pop()}]`;
      console.log(tag, 'effect start', { ready, show, src });

      updateDimensions();

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

          // Rewrite vh/vw units in CSS to use container-relative custom properties
          rewriteViewportUnits(template);

          return template;
        } catch (err) {
          console.error(tag, 'template load failed', err);
          setError(
            `Failed to load template: ${err instanceof Error ? err.message : String(err)}`,
          );
          throw err;
        }
      };

      console.log(tag, 'url set', `+${(performance.now() - t0).toFixed(0)}ms`);
      lynxViewRef.current.url = src;

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
      const timer = setTimeout(() => {
        if (!renderedRef.current) {
          console.error(
            tag,
            'render timeout',
            `+${(performance.now() - t0).toFixed(0)}ms`,
          );
          setError('Preview timed out: rendering did not complete within 5s');
        }
      }, 5000);
      return () => {
        disposed = true;
        clearTimeout(timer);
        mo?.disconnect();
        removeClickFix?.();
      };
    }
  }, [ready, show, src, updateDimensions]);

  // Keep lynx-view dimensions in sync when the container is resized
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready) return;
    const ro = new ResizeObserver(() => updateDimensions());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, updateDimensions]);

  const loading = show && (!ready || !rendered || !!error);

  return (
    <div
      ref={containerRef}
      style={{
        display: show ? 'flex' : 'none',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <LoadingOverlay visible={loading} error={error} />
      {show && src && (
        <lynx-view
          ref={lynxViewRef}
          style={LYNX_VIEW_STYLE}
          lynx-group-id={2}
          transform-vh={true}
          transform-vw={true}
        />
      )}
    </div>
  );
};
