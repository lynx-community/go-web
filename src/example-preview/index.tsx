import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import type { PreviewTab, WebLoadingScreen } from '../config';
import { useGoConfig } from '../config';
import { ExampleContent } from './components';
import { UltraLynxView } from './components/ultra-lynx-view';
import type { SchemaOptionsData } from './hooks/use-switch-schema';
import { isAssetFileType } from './utils/example-data';
import type { WebPreviewMode } from './utils/resolve-web-preview';

const DefaultErrorWrap = ({
  example,
  exampleBaseUrl,
}: {
  example: string;
  exampleBaseUrl: string;
}) => {
  return (
    <div
      style={{
        padding: '16px',
        border: '1px solid #e74c3c',
        borderRadius: '8px',
        background: '#fdf0ef',
      }}
    >
      <strong>Error Loading Example Data</strong>
      <p>
        Error loading Example data for example: <code>{example}</code>
        <br />
        Please check if the file <code>example-metadata.json</code> exists in{' '}
        <code>
          {exampleBaseUrl}/{example}
        </code>{' '}
        .
      </p>
    </div>
  );
};

export type ExamplePreviewMode = 'linked' | 'preview' | 'source' | 'ultra';

export interface ExamplePreviewProps {
  example: string;
  defaultFile?: string;
  img?: string;
  defaultEntryFile?: string;
  defaultEntryName?: string;
  highlight?: string | Record<string, string>;
  entry?: string | string[];
  schema?: string;
  rightFooter?: React.ReactNode;
  schemaOptions?: SchemaOptionsData;
  langAlias?: Record<string, string>;
  mode?: ExamplePreviewMode;
  webPreviewMode?: WebPreviewMode;
  webPreview?: boolean;
  designWidth?: number;
  designHeight?: number;
  fitThresholdScale?: number;
  fitMinScale?: number;
  fit?: 'contain' | 'cover' | 'auto';
  /**
   * Override the default preview tab for this instance.
   * Takes precedence over the site-level `GoConfig.defaultTab`.
   *
   * - `'preview'` — static screenshot (requires `img`)
   * - `'web'`     — live web preview (requires `webFile` in metadata)
   * - `'qrcode'`  — QR code for Lynx Explorer
   */
  defaultTab?: PreviewTab;
  /**
   * What to show while the Web tab loads.
   * Takes precedence over the site-level `GoConfig.webLoadingScreen`.
   *
   * - `'overlay'` — spinner overlay inside the Web panel
   * - `'preview'` — keep the Preview image/video visible until `<lynx-view>`
   *   has painted, then reveal/switch to the Web tab. Soft refresh still uses
   *   the spinner overlay.
   *
   * When omitted, auto-selects `'preview'` if `defaultTab` is `'web'` and a
   * preview image exists; otherwise `'overlay'`. Explicit `'preview'` also
   * falls back to `'overlay'` when no preview image exists.
   */
  webLoadingScreen?: WebLoadingScreen;
  /**
   * Deep link URL template for opening the app locally.
   *
   * Supports templating with the currently selected entry URL:
   * - `{{{url}}}` -- raw entry URL
   * - `{{{urlEncoded}}}` -- `encodeURIComponent(entryUrl)`
   *
   * Example: `'lynxtron-go://open?url={{{urlEncoded}}}'`
   */
  deepLinkUrl?: string;
  /**
   * Native framework required by the bundle at runtime, e.g. `"lynxtron"` or
   * `"sparkling"`. Unset ⇒ no native framework dependency, universally
   * compatible (opens in Lynx Explorer by default). Prop overrides the value
   * declared in `example-metadata.json`.
   */
  nativeFramework?: string;
  /** @internal Force mobile mode for testing. */
  _forceMobile?: boolean;
}

export interface ExampleMetadata {
  name: string;
  files: string[];
  templateFiles: Array<{
    name: string;
    file: string;
    webFile?: string;
  }>;
  previewImage?: string;
  exampleGitBaseUrl?: string;
  /**
   * Native framework this example depends on at runtime (e.g. `"lynxtron"`).
   * Absent means no native framework dep — universally compatible.
   */
  nativeFramework?: string;
}

export const ExamplePreview = (props: ExamplePreviewProps) => {
  const {
    exampleBasePath,
    ErrorComponent,
    SSGComponent,
    defaultTab: configDefaultTab,
    webLoadingScreen: configWebLoadingScreen,
    withBase: withBaseFn = (p: string) => p,
  } = useGoConfig();
  const EXAMPLE_BASE_URL = withBaseFn(exampleBasePath);

  if (import.meta.env.SSG_MD && SSGComponent) {
    return <SSGComponent {...props} />;
  }

  const {
    example,
    defaultFile = 'package.json',
    defaultEntryFile,
    defaultEntryName,
    highlight,
    img,
    entry,
    schema,
    rightFooter,
    schemaOptions,
    langAlias,
    defaultTab: propsDefaultTab,
    webLoadingScreen: propsWebLoadingScreen,
    mode = 'linked',
    webPreviewMode = 'responsive',
    webPreview = true,
    designWidth = 375,
    designHeight = 812,
    fitThresholdScale = 1.0,
    fitMinScale = 0.5,
    fit = 'cover',
    deepLinkUrl,
    nativeFramework: nativeFrameworkProp,
    _forceMobile,
  } = props;

  // Instance prop wins over provider config. Leave unset so ExampleContent can
  // auto-pick `'preview'` when defaulting to Web with a preview image.
  const defaultTab = propsDefaultTab ?? configDefaultTab;
  const webLoadingScreen = propsWebLoadingScreen ?? configWebLoadingScreen;
  // When web preview is disabled, ignore an explicit 'web' defaultTab so we
  // don't leave the UI stuck on a tab that cannot resolve.
  const resolvedDefaultTab =
    webPreview === false && defaultTab === 'web' ? undefined : defaultTab;

  const [currentName, setCurrentName] = useState(defaultFile);
  const [currentFile, setCurrentFile] = useState('');
  const [isAssetFile, setIsAssetFile] = useState(isAssetFileType(defaultFile));
  const [currentEntry, setCurrentEntry] = useState('');

  const [defaultWebPreviewFile, setDefaultWebPreviewFile] = useState('');
  const [initState, setInitState] = useState(false);
  const storeRef = useRef<Record<string, string>>({});
  const highlightData = useMemo(() => {
    return typeof highlight === 'string'
      ? { [defaultFile]: highlight }
      : highlight || {};
  }, [highlight, defaultFile]);

  const { error, data: exampleData } = useSWR<ExampleMetadata>(
    `${EXAMPLE_BASE_URL}/${example}/example-metadata.json`,

    async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(response.status.toString());
      }
      return await response.json();
    },
    { revalidateOnFocus: false },
  );

  const { trigger } = useSWRMutation(
    `${EXAMPLE_BASE_URL}/${example}/${currentName}`,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(response.status.toString());
      }
      const text = await response.text();
      return text;
    },
  );
  const updateCurrentName = (v: string) => {
    setCurrentName(v);
    setIsAssetFile(isAssetFileType(v));
  };
  useEffect(() => {
    if (mode === 'preview' || mode === 'ultra') return;
    if (isAssetFile) {
      setCurrentFile(`${EXAMPLE_BASE_URL}/${example}/${currentName}`);
    } else {
      if (storeRef.current[currentName]) {
        setCurrentFile(storeRef.current[currentName]);
      } else {
        trigger().then((res) => {
          setCurrentFile(res);
          storeRef.current[currentName] = res;
        });
      }
    }
  }, [currentName, isAssetFile, mode]);

  const currentEntryFileUrl = useMemo(() => {
    const file = exampleData?.templateFiles?.find(
      (file) => file.name === currentEntry,
    );
    if (file) {
      const url = `${window.location.origin}${EXAMPLE_BASE_URL}/${example}/${file?.file}`;
      if (schema) {
        const schemaUrl = schema.replace('{{{url}}}', url);
        return schemaUrl;
      }
      return url;
    }
    return '';
  }, [exampleData, currentEntry, schema]);

  useEffect(() => {
    if (exampleData?.templateFiles && exampleData?.templateFiles.length > 0) {
      let tmpEntry;
      // if defaultEntryFile is provided, use it, if not, use defaultEntryName, if not, use the first file
      if (defaultEntryFile) {
        const entry =
          exampleData?.templateFiles.find(
            (file) => file.file === defaultEntryFile,
          ) ||
          exampleData?.templateFiles.find((file) =>
            file.file.startsWith(defaultEntryFile),
          );
        if (entry) {
          tmpEntry = entry;
        }
      } else if (defaultEntryName) {
        const entry = exampleData?.templateFiles.find(
          (file) => file.name === defaultEntryName,
        );
        if (entry) {
          tmpEntry = entry;
        }
      } else {
        tmpEntry = exampleData?.templateFiles[0];
      }
      if (tmpEntry) {
        if (tmpEntry.webFile && webPreview !== false) {
          const fullWebFile = `${window.location.origin}${EXAMPLE_BASE_URL}/${example}/${tmpEntry.webFile}`;
          setDefaultWebPreviewFile(fullWebFile);
        } else {
          setDefaultWebPreviewFile('');
        }
        setCurrentEntry(tmpEntry.name);
      } else {
        console.warn(
          'defaultEntryFile or defaultEntryName params error, please check!',
        );
      }
      setInitState(true);
    }
  }, [exampleData, defaultEntryFile, defaultEntryName, webPreview]);

  if (error) {
    const ErrorComp = ErrorComponent || DefaultErrorWrap;
    return <ErrorComp example={example} exampleBaseUrl={EXAMPLE_BASE_URL} />;
  }

  // Ultra: Go is only a chromeless full-viewport <lynx-view>.
  if (mode === 'ultra') {
    if (initState && !defaultWebPreviewFile) {
      const ErrorComp = ErrorComponent || DefaultErrorWrap;
      return <ErrorComp example={example} exampleBaseUrl={EXAMPLE_BASE_URL} />;
    }
    if (!defaultWebPreviewFile) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            zIndex: 99999,
          }}
        />
      );
    }
    return (
      <UltraLynxView
        src={defaultWebPreviewFile}
        webPreviewMode={webPreviewMode}
        designWidth={designWidth}
        designHeight={designHeight}
        fitThresholdScale={fitThresholdScale}
        fitMinScale={fitMinScale}
        fit={fit}
      />
    );
  }

  return (
    <ExampleContent
      name={example}
      directory={exampleData?.name}
      isAssetFile={isAssetFile}
      updateCurrentName={updateCurrentName}
      currentFile={currentFile}
      currentFileName={currentName}
      fileNames={exampleData?.files || []}
      previewImage={
        img ||
        (exampleData?.previewImage
          ? `${EXAMPLE_BASE_URL}/${example}/${exampleData?.previewImage}`
          : '')
      }
      langAlias={langAlias}
      currentEntryFileUrl={currentEntryFileUrl}
      currentEntry={currentEntry}
      setCurrentEntry={setCurrentEntry}
      entryFiles={exampleData?.templateFiles}
      highlight={highlightData[currentName]}
      entry={entry}
      defaultWebPreviewFile={defaultWebPreviewFile}
      initState={initState}
      rightFooter={rightFooter}
      schemaOptions={schema ? undefined : schemaOptions}
      exampleGitBaseUrl={exampleData?.exampleGitBaseUrl}
      defaultTab={resolvedDefaultTab}
      webLoadingScreen={webLoadingScreen}
      mode={mode}
      webPreviewMode={webPreviewMode}
      designWidth={designWidth}
      designHeight={designHeight}
      fitThresholdScale={fitThresholdScale}
      fitMinScale={fitMinScale}
      fit={fit}
      deepLinkUrl={deepLinkUrl}
      nativeFramework={nativeFrameworkProp ?? exampleData?.nativeFramework}
      _forceMobile={_forceMobile}
    />
  );
};
