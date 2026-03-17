import React, { useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { IconHandle } from '@douyinfe/semi-icons';

const COLLAPSED_SIZE = 0;
const DIVIDER_SIZE = 10;

// --- Preview panel thresholds ---
const PREVIEW_H_COLLAPSE = 260;
const PREVIEW_V_COLLAPSE = 160;
const PREVIEW_SOFT_MIN = 200;

// --- Code panel thresholds ---
const CODE_H_COLLAPSE = 160;
const CODE_V_COLLAPSE = 160;
const CODE_SOFT_MIN = 200;

// Default preview size when expanding from collapsed or switching axis.
const H_DEFAULT = 280;

// Opacity applied directly to panel wrapper DOM elements during drag
const SNAP_OPACITY = '0.4';

export interface SplitPaneHandle {
  ensureSecondMinSize: (min: number) => void;
}

interface SplitPaneProps {
  first: React.ReactNode;
  second: React.ReactNode;
  show: boolean;
  vertical?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  firstCollapsed?: boolean;
  onFirstCollapsedChange?: (collapsed: boolean) => void;
}

/** Measure the available inner size (content-box) of the split-pane container. */
function getContainerInner(el: HTMLElement | null, vertical: boolean): number {
  if (!el) return 0;
  const s = getComputedStyle(el);
  if (vertical) {
    return el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
  }
  return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
}

export const SplitPane = React.forwardRef<SplitPaneHandle, SplitPaneProps>(({
  first,
  second,
  show,
  vertical = false,
  collapsed = false,
  onCollapsedChange,
  firstCollapsed = false,
  onFirstCollapsedChange,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<number | null>(null); // committed pixel size of second panel
  const initialVertical = useRef(vertical);
  const prevCollapsed = useRef(collapsed);
  const prevFirstCollapsed = useRef(firstCollapsed);
  const snapZoneRef = useRef<'none' | 'preview' | 'code'>('none');

  const previewCollapse = vertical ? PREVIEW_V_COLLAPSE : PREVIEW_H_COLLAPSE;
  const codeCollapse = vertical ? CODE_V_COLLAPSE : CODE_H_COLLAPSE;

  // Set the second panel's flex-basis directly on the DOM.
  // max-width/max-height is clamped to (container - divider) so the second
  // panel can never overflow the container even if flexBasis is temporarily large.
  const setSecondSize = useCallback(
    (px: number) => {
      const el = secondRef.current;
      if (!el) return;
      const containerInner = getContainerInner(containerRef.current, vertical);
      const max = containerInner > 0 ? containerInner - DIVIDER_SIZE : px;
      if (vertical) {
        el.style.flexBasis = `${px}px`;
        el.style.width = '';
        el.style.maxWidth = '';
        el.style.height = `${px}px`;
        el.style.maxHeight = `${max}px`;
      } else {
        el.style.flexBasis = `${px}px`;
        el.style.width = `${px}px`;
        el.style.maxWidth = `${max}px`;
        el.style.height = '';
        el.style.maxHeight = '';
      }
      sizeRef.current = px;
    },
    [vertical],
  );

  useImperativeHandle(ref, () => ({
    ensureSecondMinSize(min: number) {
      if (sizeRef.current !== null && sizeRef.current < min) {
        setSecondSize(min);
      }
    },
  }), [setSecondSize]);

  // Reset size when switching between vertical and horizontal modes.
  useLayoutEffect(() => {
    if (vertical === initialVertical.current) return;
    initialVertical.current = vertical;

    if (vertical) {
      if (collapsed) {
        setSecondSize(COLLAPSED_SIZE);
      } else {
        const containerInner = getContainerInner(containerRef.current, true);
        setSecondSize(containerInner ? Math.round((containerInner - DIVIDER_SIZE) / 2) : COLLAPSED_SIZE);
      }
    } else {
      setSecondSize(collapsed ? COLLAPSED_SIZE : H_DEFAULT);
    }
  }, [vertical, collapsed, setSecondSize]);

  // Handle preview collapse/expand triggered by parent (toggle button).
  useLayoutEffect(() => {
    if (collapsed === prevCollapsed.current) return;
    prevCollapsed.current = collapsed;

    if (collapsed) {
      setSecondSize(COLLAPSED_SIZE);
    } else {
      const currentSize = sizeRef.current ?? 0;
      if (currentSize < previewCollapse) {
        if (vertical) {
          const containerInner = getContainerInner(containerRef.current, true);
          setSecondSize(containerInner ? Math.round((containerInner - DIVIDER_SIZE) / 2) : COLLAPSED_SIZE);
        } else {
          setSecondSize(H_DEFAULT);
        }
      }
    }
  }, [collapsed, vertical, previewCollapse, setSecondSize]);

  // Handle first-panel collapse/expand triggered by parent (toggle button).
  useLayoutEffect(() => {
    if (firstCollapsed === prevFirstCollapsed.current) return;
    prevFirstCollapsed.current = firstCollapsed;

    if (firstCollapsed) {
      const containerInner = getContainerInner(containerRef.current, vertical);
      const target = Math.max(containerInner - DIVIDER_SIZE, 0);
      setSecondSize(target || COLLAPSED_SIZE);
    } else {
      const containerInner = getContainerInner(containerRef.current, vertical);
      const currentSize = sizeRef.current ?? 0;
      const codeSize = containerInner - currentSize - DIVIDER_SIZE;

      if (codeSize < codeCollapse) {
        if (vertical) {
          setSecondSize(containerInner ? Math.round((containerInner - DIVIDER_SIZE) / 2) : COLLAPSED_SIZE);
        } else {
          setSecondSize(H_DEFAULT);
        }
      }
    }
  }, [firstCollapsed, vertical, codeCollapse, setSecondSize]);

  // Set initial size on mount
  useLayoutEffect(() => {
    if (sizeRef.current !== null) return;
    if (collapsed) {
      setSecondSize(COLLAPSED_SIZE);
    } else if (firstCollapsed) {
      const containerInner = getContainerInner(containerRef.current, vertical);
      setSecondSize(Math.max(containerInner - DIVIDER_SIZE, 0) || COLLAPSED_SIZE);
    } else if (vertical) {
      const containerInner = getContainerInner(containerRef.current, true);
      setSecondSize(containerInner ? Math.round((containerInner - DIVIDER_SIZE) / 2) : COLLAPSED_SIZE);
    } else {
      setSecondSize(H_DEFAULT);
    }
  }, [collapsed, firstCollapsed, vertical, setSecondSize]);

  const clearSnapHints = useCallback(() => {
    if (firstRef.current) firstRef.current.style.opacity = '';
    if (secondRef.current) secondRef.current.style.opacity = '';
    snapZoneRef.current = 'none';
  }, []);

  const KEYBOARD_STEP = 20;
  const KEYBOARD_STEP_LARGE = 60;

  /** Commit a final size after drag ends, handling collapse/expand/snap-back. */
  const commitSize = useCallback(
    (previewSize: number) => {
      const containerInner = getContainerInner(containerRef.current, vertical);
      const codeSize = containerInner - previewSize - DIVIDER_SIZE;

      // --- Preview collapse/expand ---
      if (onCollapsedChange) {
        if (collapsed) {
          if (previewSize > previewCollapse) {
            sizeRef.current = previewSize;
            onCollapsedChange(false);
          } else {
            setSecondSize(COLLAPSED_SIZE);
          }
          return;
        }

        if (!firstCollapsed && previewSize < previewCollapse) {
          sizeRef.current = previewSize;
          onCollapsedChange(true);
          return;
        }
      }

      // --- Code collapse/expand ---
      if (onFirstCollapsedChange && !collapsed) {
        if (firstCollapsed) {
          if (codeSize > codeCollapse) {
            sizeRef.current = previewSize;
            onFirstCollapsedChange(false);
          } else {
            setSecondSize(containerInner - DIVIDER_SIZE);
          }
          return;
        }

        if (codeSize < codeCollapse && containerInner > 0) {
          sizeRef.current = previewSize;
          onFirstCollapsedChange(true);
          return;
        }
      }

      // --- Soft min snap-back ---
      if (!collapsed && !firstCollapsed && containerInner > 0) {
        const maxPreview = Math.max(containerInner - CODE_SOFT_MIN - DIVIDER_SIZE, 0);
        const minPreview = PREVIEW_SOFT_MIN;

        if (previewSize > maxPreview && maxPreview > 0) {
          setSecondSize(maxPreview);
        } else if (previewSize < minPreview && minPreview < containerInner) {
          setSecondSize(minPreview);
        } else {
          setSecondSize(previewSize);
        }
      } else {
        setSecondSize(previewSize);
      }
    },
    [
      vertical,
      collapsed,
      firstCollapsed,
      previewCollapse,
      codeCollapse,
      onCollapsedChange,
      onFirstCollapsedChange,
      setSecondSize,
    ],
  );

  /** Reset both panels to default sizes. */
  const resetToDefault = useCallback(() => {
    // Expand any collapsed panels first
    if (collapsed) onCollapsedChange?.(false);
    if (firstCollapsed) onFirstCollapsedChange?.(false);

    if (vertical) {
      const containerInner = getContainerInner(containerRef.current, true);
      setSecondSize(containerInner ? Math.round((containerInner - DIVIDER_SIZE) / 2) : H_DEFAULT);
    } else {
      setSecondSize(H_DEFAULT);
    }
  }, [vertical, collapsed, firstCollapsed, onCollapsedChange, onFirstCollapsedChange, setSecondSize]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const containerEl = containerRef.current;
      const secondEl = secondRef.current;
      const firstEl = firstRef.current;
      const dividerEl = e.currentTarget as HTMLElement;
      if (!containerEl || !firstEl || !secondEl) return;

      dividerEl.setPointerCapture(e.pointerId);

      const startPos = vertical ? e.clientY : e.clientX;
      const startSize = sizeRef.current ?? 0;

      const onPointerMove = (ev: PointerEvent) => {
        const delta = vertical
          ? startPos - ev.clientY // top resize: moving up increases second panel
          : startPos - ev.clientX; // left resize: moving left increases second panel
        const newSize = Math.max(startSize + delta, 0);
        const containerInner = getContainerInner(containerEl, vertical);
        const max = containerInner > 0 ? containerInner - DIVIDER_SIZE : newSize;

        // Apply directly to DOM for performance
        if (vertical) {
          secondEl.style.flexBasis = `${newSize}px`;
          secondEl.style.height = `${newSize}px`;
          secondEl.style.maxHeight = `${max}px`;
        } else {
          secondEl.style.flexBasis = `${newSize}px`;
          secondEl.style.width = `${newSize}px`;
          secondEl.style.maxWidth = `${max}px`;
        }

        // Visual snap hints
        const codeSize = containerInner - newSize - DIVIDER_SIZE;

        let newZone: 'none' | 'preview' | 'code' = 'none';
        if (newSize < previewCollapse && !firstCollapsed) {
          newZone = 'preview';
        } else if (codeSize < codeCollapse && !collapsed && containerInner > 0) {
          newZone = 'code';
        }

        if (newZone !== snapZoneRef.current) {
          snapZoneRef.current = newZone;
          secondEl.style.opacity = newZone === 'preview' ? SNAP_OPACITY : '';
          firstEl.style.opacity = newZone === 'code' ? SNAP_OPACITY : '';
        }
      };

      const onPointerUp = (ev: PointerEvent) => {
        dividerEl.removeEventListener('pointermove', onPointerMove);
        dividerEl.removeEventListener('pointerup', onPointerUp);
        dividerEl.removeEventListener('pointercancel', onPointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        clearSnapHints();

        const delta = vertical
          ? startPos - ev.clientY
          : startPos - ev.clientX;
        const previewSize = Math.max(startSize + delta, 0);
        commitSize(previewSize);
      };

      document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      dividerEl.addEventListener('pointermove', onPointerMove);
      dividerEl.addEventListener('pointerup', onPointerUp);
      dividerEl.addEventListener('pointercancel', onPointerUp);
    },
    [
      vertical,
      collapsed,
      firstCollapsed,
      previewCollapse,
      codeCollapse,
      commitSize,
      clearSnapHints,
    ],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentSize = sizeRef.current ?? 0;
      const step = e.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;

      // In our layout, second panel is the right/bottom panel.
      // Arrow left/up → increase second panel (move divider toward first)
      // Arrow right/down → decrease second panel (move divider toward second)
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp': {
          e.preventDefault();
          const newSize = currentSize + step;
          commitSize(newSize);
          break;
        }
        case 'ArrowRight':
        case 'ArrowDown': {
          e.preventDefault();
          const newSize = Math.max(currentSize - step, 0);
          commitSize(newSize);
          break;
        }
        case 'Home': {
          e.preventDefault();
          // Collapse second panel (preview)
          onCollapsedChange?.(true);
          break;
        }
        case 'End': {
          e.preventDefault();
          // Collapse first panel (code)
          onFirstCollapsedChange?.(true);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          resetToDefault();
          break;
        }
        default:
          break;
      }
    },
    [commitSize, resetToDefault, onCollapsedChange, onFirstCollapsedChange],
  );

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      className="split-pane"
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        width: '100%',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div
        ref={firstRef}
        className="split-pane__first"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          transition: 'opacity 0.15s ease',
        }}
      >
        {first}
      </div>
      <div
        className="split-pane__divider"
        role="separator"
        tabIndex={0}
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        onPointerDown={handlePointerDown}
        onDoubleClick={resetToDefault}
        onKeyDown={handleKeyDown}
        style={{
          flex: `0 0 ${DIVIDER_SIZE}px`,
          cursor: vertical ? 'row-resize' : 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
          touchAction: 'none',
        }}
      >
        {vertical ? (
          <IconHandle
            style={{
              fontSize: '10px',
              transform: 'rotate(90deg)',
            }}
          />
        ) : (
          <IconHandle style={{ fontSize: '10px' }} />
        )}
      </div>
      <div
        ref={secondRef}
        className="split-pane__second"
        style={{
          flex: '0 0 auto',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          transition: 'opacity 0.15s ease',
        }}
      >
        {second}
      </div>
    </div>
  );
});
