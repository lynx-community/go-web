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
  GoI18nKey,
  AutoGestureOptions,
  SchemaOptionType,
  SchemaOptionsData,
} from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';
import { ExamplePreviewSSG, generateSSGHTML } from '@lynx-js/go-web/ssg';
import { mount } from '@lynx-js/go-web/embed';
import type { EmbedOptions } from '@lynx-js/go-web/embed';
import { playAutoGesture } from '@lynx-js/go-web/auto-gesture';

// A complete catalog written before example versioning remains valid.
const legacyCatalog: GoI18nCatalog = {
  'go.preview': 'Preview',
  'go.qrcode': 'QR Code',
  'go.files': 'Files',
  'go.scan.message-1': 'Scan the QR code with',
  'go.scan.message-2': 'to preview on device.',
  'go.qrcode.copy-link': 'Copy link',
  'go.qrcode.copied': 'Copied!',
  'go.qrcode.entry': 'Entry:',
  'go.openin': 'Open',
  'go.deeplink.open.default': 'Open in Lynx Explorer',
  'go.deeplink.open.lynxtron': 'Open in Lynxtron Go',
  'go.deeplink.open.sparkling': 'Open in Sparkling',
  'go.deeplink.hint-desktop': 'desktop only',
  'go.deeplink.hint-mobile': 'mobile only',
  'go.deeplink.download.default': "Didn't open? Get Lynx Explorer",
  'go.deeplink.download.lynxtron': "Didn't open? Get Lynxtron Go",
  'go.deeplink.download.sparkling': "Didn't open? Get Sparkling",
  'go.deeplink.or': 'or',
  'go.openin.show-qrcode': 'Show QR Code',
  'go.ultra': 'Open frameless',
  'go.ultra.exit': 'Exit frameless',
  'go.refresh': 'Refresh',
  'go.poweredby': 'Powered by <Go/>',
  'go.poweredby.cta': 'Want one on your own site? Open the repo',
};
const versionCatalog: GoI18nCatalog = {
  ...legacyCatalog,
  'go.example.version': 'Example version: ',
};
const previewLabel: string = legacyCatalog['go.preview'];
const optionalVersionLabel: string | undefined =
  legacyCatalog['go.example.version'];
const builtinLabels: Record<GoI18nKey, string>[] = [GO_I18N_EN, GO_I18N_ZH];
const { 'go.preview': omittedPreview, ...incompleteCatalog } = legacyCatalog;
// @ts-expect-error Existing catalog keys remain required.
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
  versionLabel: 'v',
  i18n: legacyCatalog,
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
        footerInfo={<a href="/release">Host release</a>}
        rightFooter={<a href="/notes">Source notes</a>}
        versionLabel="Version: "
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
    versionLabel: 'v',
    footerInfo: null,
    rightFooter: 'Source notes',
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
    previewLabel,
    optionalVersionLabel,
    builtinLabels,
    omittedPreview,
    invalidCatalog,
  };
}
