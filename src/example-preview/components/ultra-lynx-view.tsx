import React, { Suspense, useEffect, useRef } from 'react';
import type { WebPreviewMode } from '../utils/resolve-web-preview';
import { DefaultNoSSR, useGoConfig } from '../../config';
import s from './index.module.scss';

const WebIframe = React.lazy(() =>
  import('./web-iframe').then((module) => ({ default: module.WebIframe })),
);

export type UltraLynxViewProps = {
  /** Absolute URL to the `.web.bundle` */
  src: string;
  webPreviewMode?: WebPreviewMode;
  designWidth?: number;
  designHeight?: number;
  fitThresholdScale?: number;
  fitMinScale?: number;
  fit?: 'contain' | 'cover' | 'auto';
  /**
   * Attempt the Browser Fullscreen API after mount (requires a prior user
   * gesture in most browsers — safe to call; failures are ignored).
   */
  requestBrowserFullscreen?: boolean;
  /** Called when the user exits browser fullscreen or presses Escape */
  onExit?: () => void;
};

/**
 * Absolutely chromeless full-viewport `<lynx-view>` host.
 * No Go chrome, tabs, footer, or borders — just the Lynx Web surface.
 */
export function UltraLynxView({
  src,
  webPreviewMode = 'responsive',
  designWidth,
  designHeight,
  fitThresholdScale,
  fitMinScale,
  fit,
  requestBrowserFullscreen = false,
  onExit,
}: UltraLynxViewProps) {
  const { NoSSR: NoSSRComponent = DefaultNoSSR } = useGoConfig();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit?.();
    };
    document.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onExit]);

  useEffect(() => {
    if (!requestBrowserFullscreen || !rootRef.current) return;
    const el = rootRef.current;
    const req =
      el.requestFullscreen?.bind(el) ||
      // @ts-expect-error vendor-prefixed
      el.webkitRequestFullscreen?.bind(el);
    try {
      void req?.();
    } catch {
      /* ignored — fixed inset still covers the page */
    }

    const onFsChange = () => {
      if (!document.fullscreenElement) onExit?.();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined);
      }
    };
  }, [requestBrowserFullscreen, onExit]);

  return (
    <div className={s.ultra} ref={rootRef}>
      <NoSSRComponent>
        <Suspense fallback={null}>
          <WebIframe
            show
            src={src}
            webPreviewMode={webPreviewMode}
            designWidth={designWidth}
            designHeight={designHeight}
            fitThresholdScale={fitThresholdScale}
            fitMinScale={fitMinScale}
            fit={fit}
          />
        </Suspense>
      </NoSSRComponent>
    </div>
  );
}
