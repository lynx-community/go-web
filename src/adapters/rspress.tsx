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
 */
import React from 'react';
import {
  useI18n,
  useLang,
  useDark,
  withBase,
  NoSSR,
} from '@rspress/core/runtime';
import { CodeBlockRuntime } from '@theme';
import { transformerAddLineNumbers } from '@rspress/core/shiki-transformers';
import type { GoConfig } from '../config';
import { DEFAULT_I18N } from '../config';

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
 * Spread this into your GoConfig to wire up all rspress integrations:
 * `withBase`, `useI18n`, `useLang`, `useDark`, `NoSSR`, and `CodeBlock`.
 */
export const rspressAdapter: Pick<
  GoConfig,
  'withBase' | 'useI18n' | 'useLang' | 'useDark' | 'NoSSR' | 'CodeBlock'
> = {
  withBase,
  useI18n: () => {
    const t = useI18n();
    return (key: string) => {
      try {
        return t(key);
      } catch {
        return DEFAULT_I18N[key] || key;
      }
    };
  },
  useLang: () => useLang(),
  useDark: () => useDark(),
  NoSSR,
  CodeBlock: RspressCodeBlock,
};
