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
};

type UseWebIframeControllerArgs = {
  src: string;
  lynxViewRef: React.RefObject<LynxView>;
  dimsReady: boolean;
  containerSizeRef: React.MutableRefObject<{ width: number; height: number }>;
  /**
   * Override the pixel dimensions written to `browserConfig`.
   * In `fit` mode this should be the design canvas size × pixelRatio,
   * not the container size. Omit to use the container size (responsive mode).
   * Known limitation: `browserConfig` is only initialized once per `src`.
   */
  browserConfigSize?: { width: number; height: number };
};

type UseWebIframeControllerResult = {
  ready: boolean;
  rendered: boolean;
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

// DEV: ?simulateError=runtime|shadow|render
const simulateError =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('simulateError')
    : null;

function useWebIframeController({
  src,
  lynxViewRef,
  dimsReady,
  containerSizeRef,
  browserConfigSize,
}: UseWebIframeControllerArgs): UseWebIframeControllerResult {
  const [ready, setReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderedRef = useRef(false);
  const browserConfigInitializedRef = useRef(false);
  const lastUrlRef = useRef<string>('');

  // Reset state when src changes
  useEffect(() => {
    setRendered(false);
    setError(null);
    renderedRef.current = false;
    browserConfigInitializedRef.current = false;
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
    if (!lynxViewRef.current) return false;
    if (browserConfigInitializedRef.current) return true;
    // Use override size (fit mode: design canvas) or container size (responsive).
    const { width, height } = browserConfigSize ?? containerSizeRef.current;
    if (width === 0 || height === 0) return false;
    const pixelRatio = window.devicePixelRatio;
    lynxViewRef.current.browserConfig = {
      pixelWidth: Math.round(width * pixelRatio),
      pixelHeight: Math.round(height * pixelRatio),
      pixelRatio,
    };
    browserConfigInitializedRef.current = true;
    return true;
  }, [lynxViewRef, browserConfigSize, containerSizeRef]);

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
      const t = setTimeout(() => {
        if (!disposed)
          setError(
            'Preview timed out: shadow root was not created (simulated)',
          );
      }, 500);
      return () => {
        disposed = true;
        clearTimeout(t);
      };
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

  return { ready, rendered, error };
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
}: WebIframeProps) => {
  const lynxViewRef = useRef<LynxView>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerSizeRef = useRef({ width: 0, height: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useContainerResize({
    ref: containerRef,
    onResize: ({ width, height }) => {
      containerSizeRef.current = { width: width ?? 0, height: height ?? 0 };
      setContainerWidth(width ?? 0);
      setContainerHeight(height ?? 0);
    },
  });

  const dimsReady = containerWidth > 0 && containerHeight > 0;

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

  const browserConfigSize = usesFitPath
    ? { width: designWidth, height: designHeight }
    : undefined;

  const enableFitTransition = prevResolvedMode === 'fit' && usesFitPath;
  useEffect(() => {
    prevResolvedRef.current = {
      mode,
      fitKind: resolved.fitKind,
    };
  }, [mode, resolved.fitKind]);

  const { ready, rendered, error } = useWebIframeController({
    src,
    lynxViewRef,
    dimsReady,
    containerSizeRef,
    browserConfigSize,
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

  const lynxViewEl = src && (
    <lynx-view
      key={src}
      ref={lynxViewRef}
      style={lynxViewStyle}
      lynx-group-id={LYNX_GROUP_ID}
      transform-vh={true}
      transform-vw={true}
    />
  );

  const frameStyle =
    usesFitPath && fitStyles ? fitStyles.frame : FRAME_RESPONSIVE;
  // Always mount <lynx-view> when src exists so the ref
  // is always populated and shadow DOM persists
  // across tab switches.
  return (
    // Outer: always in layout for dimension measurement
    // Inner: controls visibility
    <div style={MEASURE_CONTAINER} ref={containerRef}>
      <div style={show ? INNER_VISIBLE : INNER_HIDDEN}>
        <LoadingOverlay visible={loading} error={error} />
        <div style={stageStyle}>
          <div style={frameStyle}>{lynxViewEl}</div>
        </div>
      </div>
    </div>
  );
};
