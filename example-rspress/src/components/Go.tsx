import React from 'react';
import {
  Go as GoBase,
  GoConfigProvider,
  type GoProps,
} from '@aspect-build/go-web';
import { rspressAdapter } from '@aspect-build/go-web/adapters/rspress';

const config = {
  exampleBasePath: '/lynx-examples',
  ...rspressAdapter,
};

export function Go(props: GoProps) {
  return (
    <GoConfigProvider config={config}>
      <GoBase {...props} />
    </GoConfigProvider>
  );
}
