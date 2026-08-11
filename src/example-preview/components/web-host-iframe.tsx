import React, { useEffect, useRef, useState } from 'react';
import { LoadingOverlay } from './loading-overlay';

type WebHostLoadState = {
  ready: boolean;
  rendered: boolean;
  stage: 'rendering' | null;
  error: string | null;
};

export type WebHostIframeProps = {
  show: boolean;
  /** Absolute URL to a complete Web application entry, usually index.html. */
  src: string;
  reloadKey?: number;
  onCanRefreshChange?: (canRefresh: boolean) => void;
  onLoadStateChange?: (state: WebHostLoadState) => void;
  hideOverlay?: boolean;
};

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const IFRAME_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 0,
  background: 'transparent',
};

/**
 * Hosts a complete Web application instead of mounting a `.web.bundle`
 * directly. The application owns its runtime, bridge and `<lynx-view>`.
 */
export const WebHostIframe = ({
  show,
  src,
  reloadKey = 0,
  onCanRefreshChange,
  onLoadStateChange,
  hideOverlay = false,
}: WebHostIframeProps) => {
  const [loaded, setLoaded] = useState(false);
  const [navigationSrc, setNavigationSrc] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const onCanRefreshChangeRef = useRef(onCanRefreshChange);
  const onLoadStateChangeRef = useRef(onLoadStateChange);
  onCanRefreshChangeRef.current = onCanRefreshChange;
  onLoadStateChangeRef.current = onLoadStateChange;

  useEffect(() => {
    setLoaded(false);
    setNavigationSrc('');
    setLoadError(null);
    onCanRefreshChangeRef.current?.(false);
    onLoadStateChangeRef.current?.({
      ready: false,
      rendered: false,
      stage: 'rendering',
      error: null,
    });

    if (!src) return;
    const url = new URL(src, window.location.href);
    if (url.origin !== window.location.origin) {
      setNavigationSrc(src);
      return;
    }

    // iframe load events also fire for HTTP error documents. A same-origin
    // preflight lets Go surface a missing host instead of treating a 404 page
    // as a rendered Lynx application. Cross-origin hosts remain iframe-only so
    // they are not incorrectly rejected when they omit CORS headers.
    const controller = new AbortController();
    void fetch(url, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Web host returned HTTP ${response.status}`);
        }
        setNavigationSrc(src);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : 'Failed to load Web host';
        setLoadError(message);
        onLoadStateChangeRef.current?.({
          ready: false,
          rendered: false,
          stage: null,
          error: message,
        });
      });

    return () => controller.abort();
  }, [src, reloadKey]);

  useEffect(
    () => () => {
      onCanRefreshChangeRef.current?.(false);
    },
    [],
  );

  const handleLoad = () => {
    setLoaded(true);
    setLoadError(null);
    onCanRefreshChangeRef.current?.(true);
    onLoadStateChangeRef.current?.({
      ready: true,
      rendered: true,
      stage: null,
      error: null,
    });
  };

  const handleError = () => {
    const message = 'Failed to load Web host';
    setLoaded(false);
    setLoadError(message);
    onCanRefreshChangeRef.current?.(false);
    onLoadStateChangeRef.current?.({
      ready: false,
      rendered: false,
      stage: null,
      error: message,
    });
  };

  return (
    <div style={{ ...CONTAINER_STYLE, display: show ? 'block' : 'none' }}>
      {navigationSrc && (
        <iframe
          key={`${navigationSrc}:${reloadKey}`}
          src={navigationSrc}
          title="Web preview"
          style={IFRAME_STYLE}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      <LoadingOverlay
        visible={show && (!!loadError || (!loaded && !hideOverlay))}
        stage="rendering"
        error={loadError}
      />
    </div>
  );
};
