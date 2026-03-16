import React from 'react';
import { IconHandle } from '@douyinfe/semi-icons';
import { Resizable } from '@douyinfe/semi-ui';

export const ResizableContainer = ({
  show,
  children,
  vertical = false,
}: {
  show: boolean;
  children: React.ReactNode;
  vertical?: boolean;
}) => {
  if (vertical) {
    return (
      <Resizable
        key="vertical"
        style={{
          display: show ? 'block' : 'none',
        }}
        enable={{
          top: true,
          right: false,
          bottom: false,
          left: false,
          topLeft: false,
          topRight: false,
          bottomLeft: false,
          bottomRight: false,
        }}
        defaultSize={{
          height: '50%',
          width: '100%',
        }}
        minHeight={100}
        maxHeight="80%"
        handleStyle={{
          top: {
            top: '-8px',
            height: '8px',
          },
        }}
        handleNode={{
          top: (
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
          ),
        }}
      >
        {children}
      </Resizable>
    );
  }

  return (
    <Resizable
      key="horizontal"
      style={{
        display: show ? 'block' : 'none',
      }}
      enable={{
        top: false,
        right: false,
        bottom: false,
        topLeft: false,
        topRight: false,
        bottomLeft: false,
        bottomRight: false,
        left: true,
      }}
      defaultSize={{
        width: 280,
      }}
      minWidth={200}
      maxWidth={600}
      handleStyle={{
        left: {
          left: '-8px',
          width: '8px',
        },
      }}
      handleNode={{
        left: (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <IconHandle style={{ fontSize: '12px', marginLeft: '-2px' }} />
          </div>
        ),
      }}
    >
      {children}
    </Resizable>
  );
};
