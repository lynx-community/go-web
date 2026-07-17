import React, { Suspense, useEffect } from 'react';
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
  /** Called when the user presses Escape */
  onExit?: () => void;
};

/**
 * Frameless full-viewport `<lynx-view>` host.
 * Dominates the browser viewport (incl. safe-area) with no Go chrome.
 * This is mobile-style frameless immersion — not OS desktop fullscreen.
 */
export function UltraLynxView({
  src,
  webPreviewMode = 'responsive',
  designWidth,
  designHeight,
  fitThresholdScale,
  fitMinScale,
  fit,
  onExit,
}: UltraLynxViewProps) {
  const { NoSSR: NoSSRComponent = DefaultNoSSR } = useGoConfig();

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

  return (
    <div className={s.ultra}>
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
