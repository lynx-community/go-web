import { Go as GoBase, GoConfigProvider, type GoProps } from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';
import { ExamplePreviewSSG } from '@lynx-js/go-web/ssg';
import path from 'path';
import { useEffect } from 'react';

const config = {
  exampleBasePath: '/lynx-examples',
  // useLang selects package en/zh catalogs; no site go.* i18n.json needed.
  ...rspressAdapter,
  SSGComponent: ExamplePreviewSSG,
  ssgExampleRoot: path?.join?.(__dirname, '../../docs/public/lynx-examples'),
};

/** Sync rspress dark mode → Semi UI body attribute */
function useSemiDarkMode() {
  const dark = rspressAdapter.useDark!();
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
