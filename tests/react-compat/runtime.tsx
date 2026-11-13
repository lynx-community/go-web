import { useEffect, type ComponentProps } from 'react';
import type { GoConfig } from '../../src/config';

export { act, createElement, version } from 'react';
export { createRoot } from 'react-dom/client';
export { GoConfigProvider } from '../../src/config';
export { Code } from '../../src/example-preview/components/code';

export function HighlightCodeBlock({
  code,
  onRendered,
}: ComponentProps<NonNullable<GoConfig['CodeBlock']>>) {
  useEffect(() => {
    onRendered?.();
  }, [code, onRendered]);
  return (
    <pre className="shiki">
      <code>
        <span className="highlighted">{code}</span>
      </code>
    </pre>
  );
}
