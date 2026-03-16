import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { IconHandle } from '@douyinfe/semi-icons';
import { Resizable } from '@douyinfe/semi-ui';

const COLLAPSED_SIZE = 0;
const FLEX_GAP = 8;

// --- Preview panel thresholds ---
// Horizontal: 260px is a UX choice — preview needs more width to be useful (image/qrcode).
const PREVIEW_H_COLLAPSE = 260;
// Vertical: smaller because height is more constrained on mobile.
const PREVIEW_V_COLLAPSE = 100;
// Soft min: code can't push preview below this (symmetric with CODE_SOFT_MIN).
const PREVIEW_SOFT_MIN = 200;

// --- Code panel thresholds ---
// Code uses a smaller collapse threshold — a narrow code pane is still somewhat readable.
const CODE_H_COLLAPSE = 100;
const CODE_V_COLLAPSE = 100;
// Soft min: preview can't push code below this.
const CODE_SOFT_MIN = 200;

// Default preview size when expanding from collapsed or switching axis.
const H_DEFAULT = 280;

// CSS classes applied directly to the DOM during drag for visual hints
const SNAP_PREVIEW_CLASS = 'snap-preview-collapse';
const SNAP_CODE_CLASS = 'snap-code-collapse';

const VerticalHandle = (
  <div
    style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
    }}
  >
    <IconHandle
      style={{
        fontSize: '12px',
        marginTop: '-2px',
        transform: 'rotate(90deg)',
      }}
    />
  </div>
);

const HorizontalHandle = (
  <div
    style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <IconHandle style={{ fontSize: '12px', marginLeft: '-2px' }} />
  </div>
);

/** Measure the available inner size (content-box) of the flex container. */
function getContainerInner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resizableRef: React.RefObject<any>,
  vertical: boolean,
): number {
  const el = resizableRef.current?.getResizable?.()?.parentElement;
  if (!el) return 0;
  const s = getComputedStyle(el);
  if (vertical) {
    return el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
  }
  return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
}

/** Remove snap-zone hint classes from the container. */
function clearSnapHints(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resizableRef: React.RefObject<any>,
) {
  const el = resizableRef.current?.getResizable?.()?.parentElement;
  el?.classList.remove(SNAP_PREVIEW_CLASS, SNAP_CODE_CLASS);
}

export const ResizableContainer = ({
  show,
  children,
  vertical = false,
  collapsed = false,
  onCollapsedChange,
  codeCollapsed = false,
  onCodeCollapsedChange,
}: {
  show: boolean;
  children: React.ReactNode;
  vertical?: boolean;
  /** Preview panel collapsed to a thin bar */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Code (sibling) panel collapsed — preview fills the space */
  codeCollapsed?: boolean;
  onCodeCollapsedChange?: (collapsed: boolean) => void;
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resizableRef = useRef<any>(null);
  const initialVertical = useRef(vertical);
  const prevCollapsed = useRef(collapsed);
  const prevCodeCollapsed = useRef(codeCollapsed);
  const snapZoneRef = useRef<'none' | 'preview' | 'code'>('none');

  const previewCollapse = vertical ? PREVIEW_V_COLLAPSE : PREVIEW_H_COLLAPSE;
  const codeCollapse = vertical ? CODE_V_COLLAPSE : CODE_H_COLLAPSE;

  // Reset size when switching between vertical and horizontal modes.
  useLayoutEffect(() => {
    if (vertical === initialVertical.current) return;
    initialVertical.current = vertical;
    if (!resizableRef.current) return;

    if (vertical) {
      resizableRef.current.setState({
        width: '100%',
        height: collapsed ? COLLAPSED_SIZE : '50%',
      });
    } else {
      resizableRef.current.setState({
        width: collapsed ? COLLAPSED_SIZE : H_DEFAULT,
        height: 'auto',
      });
    }
  }, [vertical, collapsed]);

  // Handle preview collapse/expand triggered by parent (toggle button).
  useLayoutEffect(() => {
    if (collapsed === prevCollapsed.current) return;
    prevCollapsed.current = collapsed;
    if (!resizableRef.current) return;

    if (collapsed) {
      if (vertical) {
        resizableRef.current.setState({ height: COLLAPSED_SIZE, width: '100%' });
      } else {
        resizableRef.current.setState({ width: COLLAPSED_SIZE });
      }
    } else {
      // Only reset to default if currently at collapsed size.
      // When expanding via drag, the Resizable already has the dragged size.
      const currentSize = vertical
        ? resizableRef.current.state?.height
        : resizableRef.current.state?.width;

      if (typeof currentSize === 'number' && currentSize < previewCollapse) {
        if (vertical) {
          const containerInner = getContainerInner(resizableRef, true);
          resizableRef.current.setState({
            height: containerInner ? Math.round(containerInner / 2) : '50%',
          });
        } else {
          resizableRef.current.setState({ width: H_DEFAULT });
        }
      }
    }
  }, [collapsed, vertical, previewCollapse]);

  // Handle code collapse/expand triggered by parent (toggle button).
  useLayoutEffect(() => {
    if (codeCollapsed === prevCodeCollapsed.current) return;
    prevCodeCollapsed.current = codeCollapsed;
    if (!resizableRef.current) return;

    if (codeCollapsed) {
      // Expand preview to fill — compute the exact pixel value so that
      // code panel shrinks to COLLAPSED_SIZE via flex.
      const containerInner = getContainerInner(resizableRef, vertical);
      const target = Math.max(containerInner - COLLAPSED_SIZE - FLEX_GAP, 0);
      if (vertical) {
        resizableRef.current.setState({ height: target || '90%' });
      } else {
        resizableRef.current.setState({ width: target || 9999 });
      }
    } else {
      // Shrink preview back to default — but only if it's still at the expanded size.
      // If the user dragged to a smaller size first, keep it.
      const containerInner = getContainerInner(resizableRef, vertical);
      const currentSize = vertical
        ? resizableRef.current.state?.height
        : resizableRef.current.state?.width;
      const codeSize =
        containerInner - (typeof currentSize === 'number' ? currentSize : 0) - FLEX_GAP;

      if (codeSize < codeCollapse) {
        if (vertical) {
          resizableRef.current.setState({
            height: containerInner ? Math.round(containerInner / 2) : '50%',
          });
        } else {
          resizableRef.current.setState({ width: H_DEFAULT });
        }
      }
    }
  }, [codeCollapsed, vertical, codeCollapse]);

  // --- Live visual hint during drag (direct DOM manipulation, no React re-render) ---
  const handleChange = useCallback(
    (size: { width?: number | string; height?: number | string }) => {
      const previewSize = vertical
        ? (typeof size.height === 'number' ? size.height : 0)
        : (typeof size.width === 'number' ? size.width : 0);

      const containerInner = getContainerInner(resizableRef, vertical);
      const codeSize = containerInner - previewSize - FLEX_GAP;

      // Show hint when approaching collapse from normal state,
      // OR when already collapsed and drag hasn't passed the re-open threshold.
      let newZone: 'none' | 'preview' | 'code' = 'none';
      if (previewSize < previewCollapse && !codeCollapsed) {
        newZone = 'preview';
      } else if (codeSize < codeCollapse && !collapsed && containerInner > 0) {
        newZone = 'code';
      }

      if (newZone !== snapZoneRef.current) {
        snapZoneRef.current = newZone;
        const contentEl = resizableRef.current?.getResizable?.()?.parentElement;
        if (contentEl) {
          contentEl.classList.toggle(SNAP_PREVIEW_CLASS, newZone === 'preview');
          contentEl.classList.toggle(SNAP_CODE_CLASS, newZone === 'code');
        }
      }
    },
    [vertical, collapsed, codeCollapsed, previewCollapse, codeCollapse],
  );

  const handleResizeEnd = useCallback(
    (size: { width?: number | string; height?: number | string }) => {
      // Clean up visual hints
      clearSnapHints(resizableRef);
      snapZoneRef.current = 'none';

      const previewSize = vertical
        ? (typeof size.height === 'number' ? size.height : 0)
        : (typeof size.width === 'number' ? size.width : 0);

      const containerInner = getContainerInner(resizableRef, vertical);
      const codeSize = containerInner - previewSize - FLEX_GAP;

      // Helper: snap the resizable to a given size
      const setSize = (px: number) => {
        if (vertical) {
          resizableRef.current?.setState({ height: px });
        } else {
          resizableRef.current?.setState({ width: px });
        }
      };

      // --- Preview collapse/expand ---
      if (onCollapsedChange) {
        if (collapsed) {
          // Expanding from collapsed — must drag past threshold to re-open
          if (previewSize > previewCollapse) {
            onCollapsedChange(false);
          } else {
            // Snap back to fully collapsed
            setSize(COLLAPSED_SIZE);
          }
          return;
        }

        if (!codeCollapsed && previewSize < previewCollapse) {
          onCollapsedChange(true);
          return;
        }
      }

      // --- Code collapse/expand (symmetric with preview) ---
      if (onCodeCollapsedChange && !collapsed) {
        if (codeCollapsed) {
          // Expanding from collapsed — must drag past threshold to re-open
          if (codeSize > codeCollapse) {
            onCodeCollapsedChange(false);
          } else {
            // Snap back to fully collapsed (preview fills)
            const maxPreview = Math.max(containerInner - FLEX_GAP, 0);
            setSize(maxPreview);
          }
          return;
        }

        if (codeSize < codeCollapse && containerInner > 0) {
          onCodeCollapsedChange(true);
          return;
        }
      }

      // --- Soft max snap-back (neither panel collapsed) ---
      // Protect both panels: each keeps at least its SOFT_MIN space.
      if (!collapsed && !codeCollapsed && containerInner > 0) {
        const maxPreview = Math.max(containerInner - CODE_SOFT_MIN - FLEX_GAP, 0);
        const minPreview = PREVIEW_SOFT_MIN;

        if (previewSize > maxPreview && maxPreview > 0) {
          setSize(maxPreview);
        } else if (previewSize < minPreview && minPreview < containerInner) {
          setSize(minPreview);
        }
      }
    },
    [vertical, collapsed, codeCollapsed, onCollapsedChange, onCodeCollapsedChange, previewCollapse, codeCollapse],
  );

  // No hard maxWidth/maxHeight constraints — all limits are soft (snap-back in onResizeEnd).
  // This avoids passing calc() strings to Semi which breaks Math.min in the foundation.

  return (
    <Resizable
      ref={resizableRef}
      defaultSize={
        vertical
          ? { height: collapsed ? COLLAPSED_SIZE : '50%', width: '100%' }
          : { width: collapsed ? COLLAPSED_SIZE : H_DEFAULT }
      }
      style={{
        display: show ? 'block' : 'none',
      }}
      enable={{
        top: vertical,
        right: false,
        bottom: false,
        left: !vertical,
        topLeft: false,
        topRight: false,
        bottomLeft: false,
        bottomRight: false,
      }}
      minHeight={vertical ? COLLAPSED_SIZE : undefined}
      minWidth={!vertical ? COLLAPSED_SIZE : undefined}
      handleStyle={
        vertical
          ? { top: { top: '-8px', height: '8px' } }
          : { left: { left: '-8px', width: '8px' } }
      }
      handleNode={
        vertical ? { top: VerticalHandle } : { left: HorizontalHandle }
      }
      onChange={handleChange}
      onResizeEnd={handleResizeEnd}
    >
      {children}
    </Resizable>
  );
};
