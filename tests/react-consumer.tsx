import React, { useRef } from 'react';
import {
  Go,
  GoConfigProvider,
  UltraLynxView,
  type GoConfig,
  type AutoGestureOptions,
} from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';
import { ExamplePreviewSSG, generateSSGHTML } from '@lynx-js/go-web/ssg';
import { mount, type EmbedOptions } from '@lynx-js/go-web/embed';
import { playAutoGesture } from '@lynx-js/go-web/auto-gesture';

const gesture: AutoGestureOptions = {
  steps: [
    {
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
  ],
};
const config: GoConfig = {
  exampleBasePath: '/lynx-examples',
  ...rspressAdapter,
  SSGComponent: ExamplePreviewSSG,
};

export function Consumer(): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  return (
    <GoConfigProvider config={config}>
      <Go example="hello-world" highlight="{4}" autoGesture={gesture} />
      <UltraLynxView src="/main.web.bundle" autoGesture={gesture} />
      <lynx-view ref={ref} url="/main.web.bundle" lynx-group-id={1} />
    </GoConfigProvider>
  );
}

// The global declaration remains available to existing consumers.
const legacyProps: JSX.IntrinsicElements['lynx-view'] = {
  url: '/main.web.bundle',
};
const scopedProps: React.JSX.IntrinsicElements['lynx-view'] = legacyProps;
const invalidProps: React.JSX.IntrinsicElements['lynx-view'] = {
  // @ts-expect-error A URL remains a string under both type majors.
  url: 42,
};

const invalidConfig: GoConfig = {
  exampleBasePath: '/lynx-examples',
  // @ts-expect-error Unknown loading modes must not become accepted.
  webLoadingScreen: 'invalid',
};

export function useEntryPoints(host: HTMLElement) {
  const options: EmbedOptions = { example: 'hello-world' };
  const embed = mount(host, options);
  const autoGesture = playAutoGesture(host, gesture);
  const html = generateSSGHTML({
    exampleRoot: '/lynx-examples',
    example: 'hello-world',
  });
  return { embed, autoGesture, html, scopedProps, invalidProps, invalidConfig };
}
