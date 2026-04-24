import type { LynxViewElement as LynxView } from '@lynx-js/web-core/client';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useContainerResize } from '../hooks/use-container-resize';
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

const STAGE: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
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

// DEV: ?simulateError=runtime|shadow|render
const simulateError =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('simulateError')
    : null;

type UseWebIframeControllerArgs = {
  src: string;
  lynxViewRef: React.RefObject<LynxView>;
  containerRef: React.RefObject<HTMLDivElement>;
};

function useWebIframeController({
  src,
  lynxViewRef,
  containerRef,
}: UseWebIframeControllerArgs) {
  const [ready, setReady] = useState(false);
  const [dimsReady, setDimsReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderedRef = useRef(false);
  const lastUrlRef = useRef<string>('');
  const containerSizeRef = useRef({ width: 0, height: 0 });
  const dimsReadyRef = useRef(false);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    containerSizeRef.current = { width, height };
    const nextDimsReady = width > 0 && height > 0;
    dimsReadyRef.current = nextDimsReady;
    setDimsReady(nextDimsReady);
  }, []);

  useContainerResize({
    ref: containerRef,
    onResize: ({ width, height }) => {
      const w = width ?? 0;
      const h = height ?? 0;
      containerSizeRef.current = { width: w, height: h };
      const nextDimsReady = w > 0 && h > 0;
      if (nextDimsReady !== dimsReadyRef.current) {
        dimsReadyRef.current = nextDimsReady;
        setDimsReady(nextDimsReady);
      }
    },
  });

  // Set lynx-view dimensions to match the container.
  // Called on initial setup, SystemInfo cannot be updated after that.
  const setDimensions = useCallback((): boolean => {
    if (!lynxViewRef.current) return false;

    const { width, height } = containerSizeRef.current;
    if (width === 0 || height === 0) return false;

    const pixelRatio = window.devicePixelRatio;
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);

    lynxViewRef.current.browserConfig = {
      pixelWidth,
      pixelHeight,
      pixelRatio,
    };
    return true;
  }, [lynxViewRef]);

  // Set URL eagerly once runtime is ready and element is mounted.
  // No longer gates on `show` — content is preloaded so tab switches are instant.
  // `lastUrlRef` prevents redundant url assignments that could trigger reloads.
  useEffect(() => {
    const lynxView = lynxViewRef.current;
    if (!ready || !dimsReady || !src || !lynxView) return;

    const urlAlreadySet = lastUrlRef.current === src;

    const t0 = performance.now();
    const tag = `[WebIframe ${src.split('/').pop()}]`;
    console.log(tag, 'effect start', { ready, src, urlAlreadySet });

    const initialized = setDimensions();
    if (!initialized) return;

    if (!urlAlreadySet) {
      console.log(tag, 'url set', `+${(performance.now() - t0).toFixed(0)}ms`);
      lynxView.url = src;
      lastUrlRef.current = src;
    }

    const el = lynxView as unknown as HTMLElement;
    let disposed = false;
    let mo: MutationObserver | undefined;

    const markRendered = (source: string) => {
      if (renderedRef.current) return;
      if (simulateError === 'render') return;
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
          if (timer) clearTimeout(timer);
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
      if (shadow) setupShadow(shadow);
    }

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      mo?.disconnect();
    };
  }, [ready, dimsReady, src, setDimensions, lynxViewRef]);

  return { ready, dimsReady, rendered, error };
}

export const WebIframe = ({ show, src }: WebIframeProps) => {
  const lynxViewRef = useRef<LynxView>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { ready, rendered, error } = useWebIframeController({
    src,
    lynxViewRef,
    containerRef,
  });

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
          <div style={STAGE}>
            <lynx-view
              key={src}
              ref={lynxViewRef}
              style={LYNX_VIEW_STYLE}
              lynx-group-id={LYNX_GROUP_ID}
              transform-vh={true}
              transform-vw={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};
