import type { LynxViewElement as LynxView } from '@lynx-js/web-core/client';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useContainerResize } from '../hooks/use-container-resize';
import {
  computeFrameOffset,
  computeScaleRange,
  lerpFitScale,
} from '../utils/fit-scale';
import { isFinitePositive } from '../utils/number';
import { resolveWebPreviewModeWithHysteresis } from '../utils/resolve-web-preview';
import type {
  ResolvedWebPreviewFitKind,
  WebPreviewMode,
  ResolvedWebPreviewMode,
} from '../utils/resolve-web-preview';
import { LoadingOverlay } from './loading-overlay';
import type { WebPreviewLoadStage } from './loading-overlay';

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
  url?: string;
};

type CSSVarProperties = { [key: `--${string}`]: string | number };

type AutoFitBiases = {
  interiorContainPull: number;
  interiorCoverPush: number;
};

type WebIframeProps = {
  show: boolean;
  src: string;
  webPreviewMode?: WebPreviewMode;
  designWidth?: number;
  designHeight?: number;
  fitThresholdScale?: number;
  fitMinScale?: number;
  fit?: 'contain' | 'cover' | 'auto';
  /**
   * Increment to soft-refresh the preview: call `<lynx-view>.reload()` and show
   * the loading overlay in the rendering stage (bundle already downloaded).
   */
  reloadKey?: number;
  /** Fires when the initial bundle has been downloaded and refresh is safe. */
  onCanRefreshChange?: (canRefresh: boolean) => void;
};

type UseWebIframeControllerArgs = {
  src: string;
  lynxView: LynxView | null;
  reloadKey: number;
  onCanRefreshChange?: (canRefresh: boolean) => void;
};

/** web-core marks torn-down page roots with this before clearing the shadow. */
const LYNX_DISPOSED_ATTR = 'l-disposed';

type UseWebIframeControllerResult = {
  /**
   * Lynx runtime module is loaded (web-core import resolved).
   * This does not imply the bundle has been loaded or rendered.
   */
  ready: boolean;
  /**
   * True once the Lynx page has actually painted into the shadow root
   * (`[part="page"]` / `[lynx-tag="page"]`), after a double-rAF so the overlay
   * holds through bundle download and first paint. Falls back to true after a
   * timeout if the page signal never arrives (there is no public "rendered"
   * event).
   */
  rendered: boolean;
  /**
   * Coarse load stage for the overlay detail label. Advances runtime →
   * downloading → rendering while the overlay is visible.
   */
  stage: WebPreviewLoadStage;
  /**
   * Error surfaced from runtime import failure or `<lynx-view>` error events.
   * When set, the preview should be considered failed.
   */
  error: string | null;
};

// Responsive mode: lynx-view fills the container, units track container size.
// Container-relative unit hooks for Lynx runtime:
// - `containerType: 'size'` enables `cqw/cqh` units based on the host element box.
// - `--vh-unit/--vw-unit` make `vh/vw` behave like "container viewport" inside `<lynx-view>`.
// - `--rpx-unit` aligns `rpx` scaling with a 750-wide design baseline (mobile-like behavior).
// Note: web-core already applies `contain: content` internally; combined with `containerType: 'size'`
// this effectively behaves like `contain: strict` without us overriding containment explicitly.
const LYNX_VIEW_STYLE_RESPONSIVE: React.CSSProperties & CSSVarProperties = {
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
  overflow: 'hidden',
};

const INNER_HIDDEN: React.CSSProperties = { display: 'none' };

// Responsive stage: fills parent.
const STAGE_RESPONSIVE: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

const STAGE_FIT_ANCHOR: React.CSSProperties = {
  position: 'relative',
  width: 0,
  height: 0,
  overflow: 'visible',
};

const FRAME_RESPONSIVE: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

const LYNX_GROUP_ID = 42;
const EMPTY_AUTO_FIT_BIASES: AutoFitBiases = {
  interiorContainPull: 0,
  interiorCoverPush: 0,
};

let runtimeReady: Promise<void> | null = null;
function ensureRuntime() {
  return (runtimeReady ??= import('@lynx-js/web-core/client').then(() => {}));
}

// DEV: ?simulateError=runtime|render
const simulateError =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('simulateError')
    : null;

function formatLynxErrorMessage(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || value.name;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const message = obj.message;
    if (typeof message === 'string' && message) return message;
    const nestedError = obj.error;
    const nested = formatLynxErrorMessage(nestedError);
    if (nested) return nested;
    const name = obj.name;
    const code = obj.code;
    const parts: string[] = [];
    if (typeof name === 'string' && name) parts.push(name);
    if (
      (typeof code === 'string' && code) ||
      (typeof code === 'number' && Number.isFinite(code))
    ) {
      parts.push(`code: ${String(code)}`);
    }
    if (parts.length > 0) return parts.join(' ');
    try {
      const json = JSON.stringify(value);
      if (typeof json === 'string' && json !== '{}' && json !== '[]')
        return json;
    } catch {}
    return null;
  }
  return String(value);
}

function useWebIframeController({
  src,
  lynxView,
  reloadKey,
  onCanRefreshChange,
}: UseWebIframeControllerArgs): UseWebIframeControllerResult {
  const [ready, setReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [bundlePhase, setBundlePhase] = useState<'downloading' | 'rendering'>(
    'downloading',
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const renderedRef = useRef(false);
  const bundlePhaseRef = useRef<'downloading' | 'rendering'>('downloading');
  // Soft refresh: native lynx-view.reload() — overlay stays on "rendering",
  // never re-enters the downloading stage.
  const softRefreshRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const canRefreshRef = useRef(false);
  const prevSrcRef = useRef(src);
  const prevReloadKeyRef = useRef(reloadKey);
  const onCanRefreshChangeRef = useRef(onCanRefreshChange);
  onCanRefreshChangeRef.current = onCanRefreshChange;

  const notifyCanRefresh = useCallback((can: boolean) => {
    if (canRefreshRef.current === can) return;
    canRefreshRef.current = can;
    onCanRefreshChangeRef.current?.(can);
  }, []);

  // Reset when src changes (hard load) or reloadKey changes (soft refresh).
  useEffect(() => {
    const srcChanged = prevSrcRef.current !== src;
    const reloadChanged = prevReloadKeyRef.current !== reloadKey;
    prevSrcRef.current = src;
    prevReloadKeyRef.current = reloadKey;

    setRendered(false);
    setPreviewError(null);
    renderedRef.current = false;

    if (srcChanged) {
      softRefreshRef.current = false;
      pendingReloadRef.current = false;
      notifyCanRefresh(false);
      setBundlePhase('downloading');
      bundlePhaseRef.current = 'downloading';
    } else if (reloadChanged && reloadKey > 0) {
      softRefreshRef.current = true;
      pendingReloadRef.current = true;
      setBundlePhase('rendering');
      bundlePhaseRef.current = 'rendering';
    }
  }, [src, reloadKey, notifyCanRefresh]);

  // Load web-core eagerly on mount
  useEffect(() => {
    const t = performance.now();
    if (simulateError === 'runtime') {
      setRuntimeError('Failed to load Lynx runtime: simulated error');
      return;
    }
    ensureRuntime()
      .then(() => {
        console.log(
          '[WebIframe] runtime ready',
          `${(performance.now() - t).toFixed(0)}ms`,
        );
        setRuntimeError(null);
        setReady(true);
      })
      .catch((err) => {
        console.error('[WebIframe] runtime load failed', err);
        setRuntimeError(
          `Failed to load Lynx runtime: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }, []);

  useEffect(() => {
    if (!ready || !src || !lynxView) return;
    const t0 = performance.now();
    const tag = `[WebIframe ${src.split('/').pop()}]`;

    if (simulateError === 'render') {
      const t = setTimeout(() => {
        setPreviewError('Preview failed: simulated render error');
      }, 200);
      return () => {
        clearTimeout(t);
      };
    }

    let disposed = false;
    let mo: MutationObserver | undefined;
    let raf = 0;

    // Soft refresh skips downloading; initial / src loads start there.
    const isSoftRefresh = softRefreshRef.current;
    const initialPhase: 'downloading' | 'rendering' = isSoftRefresh
      ? 'rendering'
      : 'downloading';
    setBundlePhase(initialPhase);
    bundlePhaseRef.current = initialPhase;

    // Consume the pending reload once; snapshot the pre-reload page so we
    // never treat it as the post-reload paint signal.
    const shouldReload = pendingReloadRef.current;
    if (shouldReload) pendingReloadRef.current = false;
    const host = lynxView as unknown as HTMLElement;
    const previousPage = shouldReload
      ? host.shadowRoot?.querySelector('[part="page"], [lynx-tag="page"]')
      : null;

    const unlockRefresh = () => {
      // Bundle has been downloaded (decode chrome or page paint). Parent can
      // show the refresh control from here on for this src.
      notifyCanRefresh(true);
    };

    const markRendered = (source: string) => {
      if (renderedRef.current || disposed) return;
      renderedRef.current = true;
      unlockRefresh();
      mo?.disconnect();
      console.log(
        tag,
        `rendered (${source})`,
        `+${(performance.now() - t0).toFixed(0)}ms`,
      );
      // Double-rAF: wait until after the browser has painted page content so
      // the overlay does not uncover a blank frame.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!disposed) setRendered(true);
        });
      });
    };

    const markRendering = (source: string) => {
      if (disposed || renderedRef.current) return;
      unlockRefresh();
      if (bundlePhaseRef.current === 'rendering') return;
      bundlePhaseRef.current = 'rendering';
      console.log(
        tag,
        `rendering (${source})`,
        `+${(performance.now() - t0).toFixed(0)}ms`,
      );
      setBundlePhase('rendering');
    };

    // web-core may create the shadow root asynchronously and append chrome
    // (iframe / placeholder <link>) before the template finishes downloading.
    // The rendered page root is `[part="page"]` (web-core >=0.20) or
    // `[lynx-tag="page"]` (older). Ignore disposed / pre-reload page nodes.
    const isContentReady = (shadow: ShadowRoot) => {
      const page = shadow.querySelector('[part="page"], [lynx-tag="page"]');
      if (!page) return false;
      if (page.hasAttribute(LYNX_DISPOSED_ATTR)) return false;
      if (previousPage && page === previousPage) return false;
      return true;
    };

    // Early chrome is iframe + empty blob <link>. A real <style> lands after
    // the template is decoded — use that as downloading → rendering. (Bundle
    // fetch runs in a worker, so document PerformanceObserver often misses it.)
    const hasDecodeChrome = (shadow: ShadowRoot) =>
      Array.from(shadow.querySelectorAll('style')).some(
        (el) => (el.textContent || '').trim().length > 0,
      );

    const evaluate = (shadow: ShadowRoot, source: string) => {
      if (isContentReady(shadow)) {
        markRendered(source);
        return;
      }
      if (hasDecodeChrome(shadow)) {
        markRendering(`shadow-style:${source}`);
      }
    };

    const setupShadow = (shadow: ShadowRoot) => {
      mo = new MutationObserver(() => evaluate(shadow, 'page'));
      mo.observe(shadow, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [LYNX_DISPOSED_ATTR],
      });
      evaluate(shadow, 'page-existing');
    };

    const pollShadow = () => {
      if (disposed || renderedRef.current) return;
      const shadow = host.shadowRoot;
      if (shadow) {
        setupShadow(shadow);
        // Arm observer before reload so dispose/rebuild mutations are seen.
        // Snapshotting `previousPage` prevents the pre-reload root from
        // clearing the overlay early.
        if (shouldReload) {
          console.log(tag, 'soft-refresh via lynx-view.reload()');
          lynxView.reload();
          // Cached rebuilds can finish between turns; re-check a few times.
          queueMicrotask(() => {
            if (!disposed && host.shadowRoot)
              evaluate(host.shadowRoot, 'page-microtask');
          });
          requestAnimationFrame(() => {
            if (!disposed && host.shadowRoot)
              evaluate(host.shadowRoot, 'page-raf');
          });
        }
      } else {
        raf = requestAnimationFrame(pollShadow);
      }
    };
    pollShadow();

    // Fallback: hide loading if the page signal never arrives.
    const fallback = setTimeout(() => markRendered('timeout'), 5000);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      mo?.disconnect();
    };
  }, [ready, src, lynxView, reloadKey, notifyCanRefresh]);

  useEffect(() => {
    if (!lynxView) return;
    const onError = (evt: Event) => {
      const detail = (evt as CustomEvent<any>).detail;
      const message =
        formatLynxErrorMessage(detail?.error) ??
        formatLynxErrorMessage(detail?.message) ??
        (evt instanceof ErrorEvent ? evt.message : null) ??
        'Lynx runtime error';
      setPreviewError(message);
    };
    lynxView.addEventListener('error', onError as EventListener);
    return () => {
      lynxView.removeEventListener('error', onError as EventListener);
    };
  }, [lynxView]);

  const error = runtimeError ?? previewError;
  const stage: WebPreviewLoadStage = !ready ? 'runtime' : bundlePhase;
  return { ready, rendered, stage, error };
}

function deriveFitStyles(
  containerWidth: number,
  containerHeight: number,
  designWidth: number,
  designHeight: number,
  fit: 'contain' | 'cover' | 'auto',
  autoFitBiases: AutoFitBiases,
  enableTransition: boolean,
): {
  frame: React.CSSProperties;
  lynxView: React.CSSProperties & CSSVarProperties;
} {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const createStyles = (scale: number, offsetX = 0, offsetY = 0) => ({
    frame: {
      position: 'absolute' as const,
      transformOrigin: 'top left' as const,
      width: designWidth,
      height: designHeight,
      transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
      transition: enableTransition ? 'transform 0.2s ease' : undefined,
    },
    lynxView: {
      width: designWidth,
      height: designHeight,
      containerType: 'size' as const,
      '--rpx-unit': `${designWidth / 750}px`,
      '--vh-unit': `${designHeight / 100}px`,
      '--vw-unit': `${designWidth / 100}px`,
    },
  });

  const FIT_AUTO_MAX_CROP_RATIO = 0.5;
  const FIT_AUTO_COVER_BIAS_EXP = 2;
  const FIT_AUTO_MIN_READABLE_WIDTH = Math.max(
    180,
    Math.round(designWidth * 0.58),
  );
  const FIT_AUTO_MIN_READABLE_HEIGHT = Math.max(
    220,
    Math.round(designHeight * 0.36),
  );

  if (!isFinitePositive(containerWidth) || !isFinitePositive(containerHeight)) {
    return createStyles(0);
  }

  const scaleRange = computeScaleRange({
    containerWidth,
    containerHeight,
    baseWidth: designWidth,
    baseHeight: designHeight,
  });
  if (
    !Number.isFinite(scaleRange.contain) ||
    !isFinitePositive(scaleRange.cover)
  ) {
    return createStyles(0);
  }
  let fitProgress: number;
  if (fit === 'contain') {
    fitProgress = 0;
  } else if (fit === 'cover') {
    fitProgress = 1;
  } else {
    const cropRatio = 1 - scaleRange.contain / scaleRange.cover;
    const normalizedCrop = clamp01(cropRatio / FIT_AUTO_MAX_CROP_RATIO);
    const baseProgress = 1 - Math.pow(normalizedCrop, FIT_AUTO_COVER_BIAS_EXP);
    const interiorContainPull = clamp01(autoFitBiases.interiorContainPull);
    const interiorCoverPush = clamp01(autoFitBiases.interiorCoverPush);

    fitProgress = baseProgress * (1 - interiorContainPull);
    fitProgress = fitProgress + (1 - fitProgress) * interiorCoverPush;
  }
  let scale = lerpFitScale(scaleRange, fitProgress);
  if (fit === 'auto') {
    const widthFloorScale = FIT_AUTO_MIN_READABLE_WIDTH / designWidth;
    const heightFloorScale = FIT_AUTO_MIN_READABLE_HEIGHT / designHeight;
    const autoScaleFloor = Math.max(widthFloorScale, heightFloorScale);
    const shouldForceReadable =
      containerWidth < FIT_AUTO_MIN_READABLE_WIDTH ||
      containerHeight < FIT_AUTO_MIN_READABLE_HEIGHT;
    if (shouldForceReadable && scale < autoScaleFloor) {
      fitProgress = 1;
      scale = Math.max(scaleRange.cover, autoScaleFloor);
    }
  }
  const { offsetX, offsetY } = computeFrameOffset({
    baseWidth: designWidth,
    baseHeight: designHeight,
    scale,
    ax: 0.5,
    ay: 0.5,
  });
  return createStyles(scale, offsetX, offsetY);
}

function computeAutoFitBiases(args: {
  fit: 'contain' | 'cover' | 'auto';
  webPreviewMode: WebPreviewMode;
  mode: ResolvedWebPreviewMode;
  fitKind: ResolvedWebPreviewFitKind;
  ratioW: number;
  ratioH: number;
  enterThresholdScale: number;
  enterMinScale: number;
}): AutoFitBiases {
  const {
    fit,
    webPreviewMode,
    mode,
    fitKind,
    ratioW,
    ratioH,
    enterThresholdScale,
    enterMinScale,
  } = args;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const smoothstep01 = (v: number) => {
    const t = clamp01(v);
    return t * t * (3 - 2 * t);
  };

  if (mode !== 'fit' || webPreviewMode !== 'auto' || fit !== 'auto') {
    return EMPTY_AUTO_FIT_BIASES;
  }
  if (
    !Number.isFinite(ratioW) ||
    !Number.isFinite(ratioH) ||
    !isFinitePositive(enterThresholdScale) ||
    !isFinitePositive(enterMinScale)
  ) {
    return EMPTY_AUTO_FIT_BIASES;
  }

  let interiorContainPull = 0;
  let interiorCoverPush = 0;

  if (fitKind === 'width') {
    const widthExtremeScale = Math.max(
      enterMinScale,
      enterThresholdScale * 0.62,
    );
    const widthRange = enterThresholdScale - widthExtremeScale;

    if (widthRange > 0) {
      const widthNarrowness = clamp01(
        (enterThresholdScale - ratioW) / widthRange,
      );
      const leftCoverPlateau =
        1 - smoothstep01((widthNarrowness - 0.18) / 0.48);
      const midContainWindow =
        smoothstep01((widthNarrowness - 0.4) / 0.14) *
        (1 - smoothstep01((widthNarrowness - 0.62) / 0.14));
      const rightCoverPlateau = smoothstep01((widthNarrowness - 0.76) / 0.12);
      const coverPlateau = Math.max(leftCoverPlateau, rightCoverPlateau);

      // Shape the width-driven auto-fit response as:
      // full-cover plateau -> smooth contain window -> full-cover plateau.
      interiorContainPull = midContainWindow * (1 - coverPlateau) * 0.45;
      interiorCoverPush = coverPlateau * 0.98;
    }
  } else if (fitKind === 'height') {
    const widthContainSupport = smoothstep01(
      (ratioW - enterThresholdScale * 0.98) / (enterThresholdScale * 0.22),
    );
    const heightShortness = smoothstep01(
      (enterMinScale - ratioH) / (enterMinScale * 0.5),
    );

    // When width is already fairly wide but height is slightly short, lean a
    // bit more toward contain instead of aggressively filling width.
    interiorContainPull = widthContainSupport * heightShortness * 0.45;
  }

  return {
    interiorContainPull,
    interiorCoverPush,
  };
}

export const WebIframe = ({
  show,
  src,
  webPreviewMode = 'responsive',
  designWidth = 375,
  designHeight = 812,
  fitThresholdScale = 1.0,
  fitMinScale = 0.5,
  fit = 'cover',
  reloadKey = 0,
  onCanRefreshChange,
}: WebIframeProps) => {
  const [lynxView, setLynxView] = useState<LynxView | null>(null);
  const browserConfigInitializedRef = useRef<WeakSet<LynxView>>(new WeakSet());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useContainerResize({
    ref: containerRef,
    onResize: ({ width, height }) => {
      setContainerWidth(width ?? 0);
      setContainerHeight(height ?? 0);
    },
  });

  const prevResolvedRef = useRef<{
    mode: ResolvedWebPreviewMode;
    fitKind: ResolvedWebPreviewFitKind;
  }>({
    mode: 'responsive',
    fitKind: null,
  });
  const prevResolvedMode = prevResolvedRef.current.mode;
  const resolved = resolveWebPreviewModeWithHysteresis(
    {
      webPreviewMode,
      designWidth,
      designHeight,
      fitThresholdScale,
      fitMinScale,
      containerWidth,
      containerHeight,
    },
    prevResolvedMode,
    prevResolvedRef.current.fitKind,
  );
  const mode = resolved.mode;
  const usesFitPath = mode === 'fit';

  if (
    usesFitPath &&
    (!isFinitePositive(designWidth) || !isFinitePositive(designHeight))
  ) {
    throw new RangeError(
      'WebIframe: designWidth and designHeight must be finite numbers > 0 when webPreviewMode resolves to "fit".',
    );
  }

  const enableFitTransition = prevResolvedMode === 'fit' && usesFitPath;
  useEffect(() => {
    prevResolvedRef.current = {
      mode,
      fitKind: resolved.fitKind,
    };
  }, [mode, resolved.fitKind]);

  const browserConfigArgsRef = useRef({
    usesFitPath,
    designWidth,
    designHeight,
    containerWidth,
    containerHeight,
  });
  useEffect(() => {
    browserConfigArgsRef.current = {
      usesFitPath,
      designWidth,
      designHeight,
      containerWidth,
      containerHeight,
    };
  });

  const tryInitBrowserConfig = useCallback((el: LynxView): boolean => {
    if (typeof window === 'undefined') return false;
    if (browserConfigInitializedRef.current.has(el)) return true;

    const args = browserConfigArgsRef.current;
    const pixelRatio = window.devicePixelRatio;
    const measured =
      containerRef.current?.getBoundingClientRect() ??
      el.getBoundingClientRect();

    const width = args.usesFitPath
      ? args.designWidth
      : args.containerWidth || measured.width;
    const height = args.usesFitPath
      ? args.designHeight
      : args.containerHeight || measured.height;

    if (!isFinitePositive(width) || !isFinitePositive(height)) return false;

    el.browserConfig = {
      pixelWidth: Math.round(width * pixelRatio),
      pixelHeight: Math.round(height * pixelRatio),
      pixelRatio,
    };
    browserConfigInitializedRef.current.add(el);
    return true;
  }, []);

  const handleLynxViewRef = useCallback((el: LynxView | null) => {
    setLynxView(el);
    if (!el) return;
    tryInitBrowserConfig(el);
  }, []);

  useEffect(() => {
    if (!lynxView) return;
    tryInitBrowserConfig(lynxView);
  }, [
    lynxView,
    containerWidth,
    containerHeight,
    usesFitPath,
    designWidth,
    designHeight,
    tryInitBrowserConfig,
  ]);

  const { ready, rendered, stage, error } = useWebIframeController({
    src,
    lynxView,
    reloadKey,
    onCanRefreshChange,
  });

  // `webPreviewMode='responsive'` resolves to `usesFitPath === false`,
  // which skips all fit-only interpolation and auto-fit bias logic.
  const autoFitBiases = usesFitPath
    ? computeAutoFitBiases({
        fit,
        webPreviewMode,
        mode,
        fitKind: resolved.fitKind,
        ratioW: resolved.ratioW,
        ratioH: resolved.ratioH,
        enterThresholdScale: resolved.enterThresholdScale,
        enterMinScale: resolved.enterMinScale,
      })
    : EMPTY_AUTO_FIT_BIASES;

  const fitStyles = usesFitPath
    ? deriveFitStyles(
        containerWidth,
        containerHeight,
        designWidth,
        designHeight,
        fit,
        autoFitBiases,
        enableFitTransition,
      )
    : null;

  const { stage: stageStyle, lynxView: lynxViewStyle } =
    usesFitPath && fitStyles
      ? { stage: STAGE_FIT_ANCHOR, lynxView: fitStyles.lynxView }
      : { stage: STAGE_RESPONSIVE, lynxView: LYNX_VIEW_STYLE_RESPONSIVE };

  const loading = show && (!ready || !rendered || !!error);

  // Keep `<lynx-view>` mounted across soft refreshes; reloadKey drives
  // `lynxView.reload()` inside the controller (rendering stage, not remount).
  const lynxViewNode = ready && src && (
    <lynx-view
      key={src}
      ref={handleLynxViewRef}
      url={src}
      style={lynxViewStyle}
      lynx-group-id={LYNX_GROUP_ID}
      transform-vh={true}
      transform-vw={true}
    />
  );

  const frameStyle =
    usesFitPath && fitStyles ? fitStyles.frame : FRAME_RESPONSIVE;
  return (
    // Outer: always in layout for dimension measurement
    // Inner: controls visibility
    <div style={MEASURE_CONTAINER} ref={containerRef}>
      <div style={show ? INNER_VISIBLE : INNER_HIDDEN}>
        <LoadingOverlay visible={loading} error={error} stage={stage} />
        <div style={stageStyle}>
          <div style={frameStyle}>{lynxViewNode}</div>
        </div>
      </div>
    </div>
  );
};
