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
  const onCanRefreshChangeRef = useRef(onCanRefreshChange);
  const onLoadStateChangeRef = useRef(onLoadStateChange);
  onCanRefreshChangeRef.current = onCanRefreshChange;
  onLoadStateChangeRef.current = onLoadStateChange;

  useEffect(() => {
    setLoaded(false);
    onCanRefreshChangeRef.current?.(false);
    onLoadStateChangeRef.current?.({
      ready: false,
      rendered: false,
      stage: 'rendering',
      error: null,
    });
  }, [src, reloadKey]);

  useEffect(
    () => () => {
      onCanRefreshChangeRef.current?.(false);
    },
    [],
  );

  const handleLoad = () => {
    setLoaded(true);
    onCanRefreshChangeRef.current?.(true);
    onLoadStateChangeRef.current?.({
      ready: true,
      rendered: true,
      stage: null,
      error: null,
    });
  };

  return (
    <div style={{ ...CONTAINER_STYLE, display: show ? 'block' : 'none' }}>
      {src && (
        <iframe
          key={`${src}:${reloadKey}`}
          src={src}
          title="Web preview"
          style={IFRAME_STYLE}
          onLoad={handleLoad}
        />
      )}
      <LoadingOverlay
        visible={show && !loaded && !hideOverlay}
        stage="rendering"
      />
    </div>
  );
};
