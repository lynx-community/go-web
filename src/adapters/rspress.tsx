/**
 * Rspress adapter for @lynx-js/go-web.
 *
 * Usage:
 * ```tsx
 * import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';
 * const config = { exampleBasePath: '/lynx-examples', ...rspressAdapter };
 * ```
 *
 * This file imports from `@rspress/core` and `@theme` — these resolve only
 * when the consumer's bundler processes this file (i.e. in an rspress site).
 * Non-rspress consumers never import this module, so no breakage occurs.
 *
 * Intentionally does **not** wire Rspress `useI18n`. `<Go>` owns its `go.*`
 * chrome strings (en/zh via `useLang`); override with `config.i18n` if needed.
 * Site `i18n.json` does not need `go.*` keys.
 */
import React from 'react';
import { useLang, useDark, withBase, NoSSR } from '@rspress/core/runtime';
import { CodeBlockRuntime } from '@theme';
import { transformerAddLineNumbers } from '@rspress/core/shiki-transformers';
import type { GoConfig } from '../config';

/**
 * CodeBlock wrapper that delegates to rspress's CodeBlockRuntime
 * and adds the line-numbers transformer.
 */
const RspressCodeBlock = ({
  code,
  lang,
  onRendered,
  shikiOptions,
}: {
  code: string;
  lang: string;
  onRendered?: () => void;
  shikiOptions?: Record<string, unknown>;
}) => {
  const mergedOptions = {
    ...shikiOptions,
    transformers: [
      ...((shikiOptions?.transformers as unknown[]) || []),
      transformerAddLineNumbers(),
    ],
  };
  return (
    <CodeBlockRuntime
      code={code}
      lang={lang}
      onRendered={onRendered}
      shikiOptions={mergedOptions}
    />
  );
};

/**
 * Spread this into your GoConfig to wire up rspress integrations:
 * `withBase`, `useLang`, `useDark`, `NoSSR`, and `CodeBlock`.
 *
 * Does not include `useI18n` — `<Go>` chrome copy is package-owned.
 */
export const rspressAdapter: Pick<
  GoConfig,
  'withBase' | 'useLang' | 'useDark' | 'NoSSR' | 'CodeBlock'
> = {
  withBase,
  useLang: () => useLang(),
  useDark: () => useDark(),
  NoSSR,
  CodeBlock: RspressCodeBlock,
};
