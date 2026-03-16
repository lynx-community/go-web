import React, { useEffect, useRef } from 'react';
import { IconHandle } from '@douyinfe/semi-icons';
import { Resizable } from '@douyinfe/semi-ui';

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

export const ResizableContainer = ({
  show,
  children,
  vertical = false,
  fullscreen = false,
}: {
  show: boolean;
  children: React.ReactNode;
  vertical?: boolean;
  fullscreen?: boolean;
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resizableRef = useRef<any>(null);
  const initialVertical = useRef(vertical);

  // Imperatively reset the Resizable's internal size state when switching
  // between vertical and horizontal modes, without remounting (which would
  // destroy the children / lynx-view).
  useEffect(() => {
    // Skip the initial mount — defaultSize handles that.
    if (vertical === initialVertical.current) return;
    initialVertical.current = vertical;

    if (resizableRef.current) {
      if (vertical) {
        resizableRef.current.setState({ width: '100%', height: '50%' });
      } else {
        resizableRef.current.setState({ width: 280, height: 'auto' });
      }
    }
  }, [vertical]);

  return (
    <Resizable
      ref={resizableRef}
      defaultSize={
        vertical
          ? { height: '50%', width: '100%' }
          : { width: 280 }
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
      minHeight={vertical ? 100 : undefined}
      maxHeight={vertical ? '80%' : undefined}
      minWidth={!vertical ? 260 : undefined}
      maxWidth={!vertical && !fullscreen ? 600 : undefined}
      handleStyle={
        vertical
          ? { top: { top: '-8px', height: '8px' } }
          : { left: { left: '-8px', width: '8px' } }
      }
      handleNode={
        vertical ? { top: VerticalHandle } : { left: HorizontalHandle }
      }
    >
      {children}
    </Resizable>
  );
};
