import React, { useEffect } from 'react';
import {
  Go as GoBase,
  GoConfigProvider,
  type GoProps,
} from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';
import { ExamplePreviewSSG } from '@lynx-js/go-web/ssg';
import path from 'path';

// Exclude useI18n — rspress's i18n doesn't have go.* keys.
// go-web falls back to its built-in English strings.
const { useI18n: _, ...adapter } = rspressAdapter;

const config = {
  exampleBasePath: '/lynx-examples',
  ...adapter,
  SSGComponent: ExamplePreviewSSG,
  ssgExampleRoot: path?.join?.(__dirname, '../../docs/public/lynx-examples'),
};

/** Sync rspress dark mode → Semi UI body attribute */
function useSemiDarkMode() {
  const dark = adapter.useDark!();
  useEffect(() => {
    document.body.setAttribute('theme-mode', dark ? 'dark' : 'light');
  }, [dark]);
}

export function Go(props: GoProps) {
  useSemiDarkMode();
  return (
    <GoConfigProvider config={config}>
      <GoBase {...props} />
    </GoConfigProvider>
  );
}
