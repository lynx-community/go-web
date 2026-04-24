import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import { useEffectEvent } from './use-effect-event';

type Size = {
  width?: number;
  height?: number;
};

type ResizeObserverCtor = new (
  callback: ResizeObserverCallback,
) => ResizeObserver;

type UseContainerResizeOptions<T> = {
  ref: MutableRefObject<T | null>;
  ResizeObserverImpl?: ResizeObserverCtor;
  onResize?: (size: Size) => void;
};

function useContainerResize<T extends HTMLElement = HTMLElement>({
  ref,
  ResizeObserverImpl,
  onResize: onResizeProp,
}: UseContainerResizeOptions<T>): Size {
  const [size, setSize] = useState<Size>({});
  const prev = useRef<Size>({});
  const onResize = useEffectEvent(onResizeProp);
  const hasOnResize = onResizeProp !== undefined;

  useEffect(() => {
    if (!ref.current) return;
    const RO: ResizeObserverCtor | undefined =
      ResizeObserverImpl ??
      (typeof window !== 'undefined' && 'ResizeObserver' in window
        ? window.ResizeObserver
        : undefined);

    if (!RO) return;

    const observer: ResizeObserver = new RO((entries) => {
      const entry = entries[0];
      if (!entry) return;
      let width = 0;
      let height = 0;

      const cbsUnknown = entry.contentBoxSize as unknown;

      if (Array.isArray(cbsUnknown)) {
        const first = entry.contentBoxSize[0];
        if (first) {
          width = first.inlineSize;
          height = first.blockSize;
        }
      } else if (isContentBoxSizeSingleItem(cbsUnknown)) {
        width = cbsUnknown.inlineSize;
        height = cbsUnknown.blockSize;
      } else {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
      }

      const changed =
        width !== prev.current.width || height !== prev.current.height;

      if (!changed) return;

      const next: Size = { width, height };
      prev.current = next;
      if (hasOnResize) {
        onResize(next);
      } else if (ref.current) {
        setSize(next);
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, ResizeObserverImpl, hasOnResize]);

  return size;
}

export { useContainerResize };

function isContentBoxSizeSingleItem(
  v: unknown,
): v is { inlineSize: number; blockSize: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { inlineSize?: unknown }).inlineSize === 'number' &&
    typeof (v as { blockSize?: unknown }).blockSize === 'number'
  );
}
