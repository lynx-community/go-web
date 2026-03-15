import React, { useEffect } from 'react';
import {
  Go as GoBase,
  GoConfigProvider,
  type GoProps,
} from '@aspect-build/go-web';
import { rspressAdapter } from '@aspect-build/go-web/adapters/rspress';

// Exclude useI18n — rspress's i18n doesn't have go.* keys.
// go-web falls back to its built-in English strings.
const { useI18n: _, ...adapter } = rspressAdapter;

const config = {
  exampleBasePath: '/lynx-examples',
  ...adapter,
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
