import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import type { PreviewTab } from '../config';
import { useGoConfig } from '../config';
import { ExampleContent } from './components';
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

export type ExamplePreviewMode = 'linked' | 'preview' | 'source';

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
   * Deep link URL template to open the bundle in a desktop app
   * (e.g. Lynxtron Go). Supports templating with the currently selected
   * entry URL:
   * - `{{{url}}}`        — raw URL (Lynxtron file URL when available, otherwise the QR code URL)
   * - `{{{urlEncoded}}}` — encodeURIComponent of the same URL
   */
  deepLinkUrl?: string;
  /** Custom title for the deep link button. Defaults to i18n `go.deeplink.open`. */
  deepLinkTitle?: string;
  /**
   * Optional fallback URL for downloading the desktop app. When provided and
   * the deep link does not appear to launch a registered handler within
   * ~3s (page stays visible), the user is redirected here. Mirrors the
   * electron-fiddle pattern for graceful degradation.
   */
  appDownloadUrl?: string;
}

export interface ExampleMetadata {
  name: string;
  files: string[];
  templateFiles: Array<{
    name: string;
    /** Mobile-scannable Lynx bundle URL (relative to example dir). */
    file: string;
    /** Optional web-preview bundle URL. */
    webFile?: string;
    /**
     * Optional Lynxtron desktop bundle URL. Presence of this field
     * enables the "Open in Lynxtron" deep-link button. Entries that
     * only specify `lynxtronFile` (no `file`) hide the QRCode tab.
     */
    lynxtronFile?: string;
  }>;
  previewImage?: string;
  exampleGitBaseUrl?: string;
}

export const ExamplePreview = (props: ExamplePreviewProps) => {
  const {
    exampleBasePath,
    ErrorComponent,
    SSGComponent,
    defaultTab: configDefaultTab,
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
    mode = 'linked',
    webPreviewMode = 'responsive',
    webPreview = true,
    designWidth = 375,
    designHeight = 812,
    fitThresholdScale = 1.0,
    fitMinScale = 0.5,
    fit = 'cover',
    deepLinkUrl,
    deepLinkTitle,
    appDownloadUrl,
  } = props;

  // Instance prop > config provider > undefined (let ExampleContent decide)
  const defaultTab = propsDefaultTab ?? configDefaultTab;
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
    if (mode === 'preview') return;
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

  const currentEntryLynxtronFileUrl = useMemo(() => {
    const file = exampleData?.templateFiles?.find(
      (file) => file.name === currentEntry,
    );
    if (file?.lynxtronFile) {
      return `${window.location.origin}${EXAMPLE_BASE_URL}/${example}/${file.lynxtronFile}`;
    }
    return '';
  }, [exampleData, currentEntry]);
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
      currentEntryLynxtronFileUrl={currentEntryLynxtronFileUrl}
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
      mode={mode}
      webPreviewMode={webPreviewMode}
      designWidth={designWidth}
      designHeight={designHeight}
      fitThresholdScale={fitThresholdScale}
      fitMinScale={fitMinScale}
      fit={fit}
      deepLinkUrl={deepLinkUrl}
      deepLinkTitle={deepLinkTitle}
      appDownloadUrl={appDownloadUrl}
    />
  );
};
