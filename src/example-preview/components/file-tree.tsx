import { useEffect } from 'react';

import { Tree, Typography } from '@douyinfe/semi-ui';
import { RenderFullLabelProps } from '@douyinfe/semi-ui/lib/es/tree';

import { getFolderIcon } from '../utils/icon';
import { TreeNode } from '../utils/transform';

interface FileTreeProps {
  onSelect?: (value: string) => void;
  entry?: string | string[];
  treeData: TreeNode[];
  doChangeExpand: (keys: string[]) => void;
  selectedKeys: string[];
  expandedKeys: string[];
}

export function FileTree({
  onSelect,
  entry,
  treeData,
  doChangeExpand,
  selectedKeys,
  expandedKeys,
}: FileTreeProps) {
  const doRenderLabel = ({
    className,
    data,
    onClick,
    onExpand,
    expandIcon,
  }: RenderFullLabelProps) => {
    const { label, icon, key, children, highlight } = data;
    const isLeaf = !children?.length;
    const ExpandIcon = getFolderIcon(!0);

    const renderIcon =
      !isLeaf && expandedKeys.includes(key ?? '') ? (
        <ExpandIcon style={{ marginRight: '6px', fontSize: '18px' }} />
      ) : (
        icon
      );
    const highStyle = entry
      ? {
          opacity: highlight ? 1 : 0.3,
        }
      : {};

    return (
      <li
        className={className}
        style={{
          height: '32px',
          borderRadius: '8px',
          ...highStyle,
        }}
        id={selectedKeys[0] === key ? key : undefined}
        onClick={isLeaf ? onClick : onExpand}
      >
        {isLeaf ? (
          <span style={{ width: '24px', flexShrink: 0 }} />
        ) : (
          expandIcon
        )}
        <span style={{ flexShrink: 0 }}>{renderIcon}</span>
        <Typography.Text ellipsis={{ showTooltip: true }}>
          {label}
        </Typography.Text>
      </li>
    );
  };
  useEffect(() => {
    requestAnimationFrame(() => {
      const selectedNode = document.getElementById(selectedKeys[0]);
      if (selectedNode) {
        selectedNode.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    });
  }, [selectedKeys]);

  return (
    <Tree
      defaultExpandAll
      defaultValue={selectedKeys}
      defaultExpandedKeys={selectedKeys}
      expandedKeys={expandedKeys}
      onExpand={doChangeExpand}
      renderFullLabel={doRenderLabel}
      onSelect={(selectedKey, selected, selectedNode) => {
        if (
          selected &&
          !selectedKeys.includes(selectedKey) &&
          !selectedNode?.children?.length
        ) {
          onSelect?.(selectedKey);
        }
      }}
      treeData={treeData}
    />
  );
}
