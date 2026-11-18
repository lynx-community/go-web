import { useRef } from 'react';
import type React from 'react';
import {
  Go,
  GoConfigProvider,
  GO_I18N_EN,
  GO_I18N_ZH,
  UltraLynxView,
} from '@lynx-js/go-web';
import type {
  GoConfig,
  GoI18nCatalog,
  AutoGestureOptions,
  SchemaOptionType,
  SchemaOptionsData,
} from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';
import { ExamplePreviewSSG, generateSSGHTML } from '@lynx-js/go-web/ssg';
import { mount } from '@lynx-js/go-web/embed';
import type { EmbedOptions } from '@lynx-js/go-web/embed';
import { playAutoGesture } from '@lynx-js/go-web/auto-gesture';

const versionCatalog: GoI18nCatalog = {
  ...GO_I18N_EN,
  'go.example.version.label': 'v',
  'go.example.version.description': 'Example version:',
};
const versionDescription: string =
  versionCatalog['go.example.version.description'];
const builtinCatalogs: GoI18nCatalog[] = [GO_I18N_EN, GO_I18N_ZH];
const {
  'go.example.version.description': omittedDescription,
  ...incompleteCatalog
} = versionCatalog;
// @ts-expect-error Complete catalogs require every package-owned key.
const invalidCatalog: GoI18nCatalog = incompleteCatalog;

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
  i18n: { 'go.preview': 'Preview', 'go.example.version.label': 'r' },
};

const schemaOption: SchemaOptionType = {
  type: 'host',
  name: 'Example host',
  schema: 'host://open?url={{{url}}}',
  prefix: 'host',
};
const schemaOptions: SchemaOptionsData = {
  host: schemaOption,
  anotherHost: {
    name: 'Another host',
    schema: 'another-host://open?url={{{url}}}',
  },
};

const AnchorLink: NonNullable<GoConfig['Link']> = (props) => <a {...props} />;
const link = (
  <AnchorLink
    href="/guide"
    target="_blank"
    rel="noopener noreferrer"
    onClick={(event) => event.currentTarget.focus()}
  >
    Example host
  </AnchorLink>
);

export function Consumer(): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  return (
    <GoConfigProvider config={config}>
      <Go
        example="hello-world"
        highlight="{4}"
        autoGesture={gesture}
        schemaOptions={schemaOptions}
        qrcodeNote={<aside>Use a compatible preview host.</aside>}
        rightFooter={<a href="/notes">Source notes</a>}
      />
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
  return {
    embed,
    autoGesture,
    html,
    scopedProps,
    invalidProps,
    invalidConfig,
    link,
    versionCatalog,
    versionDescription,
    builtinCatalogs,
    omittedDescription,
    invalidCatalog,
  };
}
