import { IconChevronRightStroked, IconList } from '@douyinfe/semi-icons';
import {
  Button,
  Radio,
  RadioGroup,
  Select,
  SideSheet,
  Space,
  Switch,
  TabPane,
  Tabs,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { CodeView } from './code-view';
import { FileTree } from './file-tree';
import { DeepLinkRow, FloatingDeepLink, OpenInHint } from './open-in-panel';
import { PreviewImg } from './preview-img';
import { SplitPane, type SplitPaneHandle } from './split-pane';
import { SwitchSchema } from './switch-schema';

import type { PreviewTab } from '../../config';
import { DEFAULT_I18N, DefaultNoSSR, useGoConfig } from '../../config';
import { useIsMobile } from '../hooks/use-is-mobile';
import type { SchemaOptionsData } from '../hooks/use-switch-schema';
import { useTreeController } from '../hooks/use-tree-controller';
import {
  IconCopyLink,
  IconExitFullscreen,
  IconFullscreen,
  IconGithub,
  IconOpenExternal,
} from '../utils/icon';
import { getFrameworkConfig } from '../utils/native-frameworks';
import { isQrAllowed, resolveOpenIn } from '../utils/open-in-mode';
import type { WebPreviewMode } from '../utils/resolve-web-preview';
import { tabScrollToTop } from '../utils/tool';

const WebIframe = React.lazy(() =>
  import('./web-iframe').then((module) => ({ default: module.WebIframe })),
);

import s from './index.module.scss';

const DEFAULT_EXPLORER_URL_CN =
  '/zh/guide/start/quick-start.html#download-lynx-explorer,ios-simulator-platform=macos-arm64,explorer-platform=ios-simulator';

const DEFAULT_EXPLORER_URL_EN =
  '/guide/start/quick-start.html#download-lynx-explorer,ios-simulator-platform=macos-arm64,explorer-platform=ios-simulator';

enum PreviewType {
  Preview = 'Preview',
  QRCode = 'QRCode',
  Web = 'Web',
}

import type { ExamplePreviewMode } from '../index';

interface ExampleContentProps {
  fileNames: string[];
  previewImage: string;
  currentFileName: string;
  currentFile: string;
  updateCurrentName: (v: string) => void;
  isAssetFile: boolean;
  name: string;
  directory?: string;
  currentEntryFileUrl: string;
  currentEntry: string;
  entryFiles?: { name: string; file: string }[];
  setCurrentEntry: (v: string) => void;
  highlight?: string;
  entry?: string | string[];
  defaultWebPreviewFile?: string;
  initState: boolean;
  rightFooter?: React.ReactNode;
  schemaOptions?: SchemaOptionsData;
  exampleGitBaseUrl?: string;
  langAlias?: Record<string, string>;
  defaultTab?: PreviewTab;
  mode?: ExamplePreviewMode;
  webPreviewMode?: WebPreviewMode;
  designWidth?: number;
  designHeight?: number;
  fitThresholdScale?: number;
  fitMinScale?: number;
  fit?: 'contain' | 'cover' | 'auto';
  deepLinkUrl?: string;
  /** Native framework required by this bundle at runtime (e.g. `"lynxtron"`). */
  nativeFramework?: string;
  /** @internal Force mobile mode for testing in the standalone example. */
  _forceMobile?: boolean;
}

export function ExampleContent({
  fileNames,
  previewImage,
  currentFileName,
  currentFile,
  updateCurrentName,
  isAssetFile,
  name,
  directory,
  currentEntryFileUrl,
  currentEntry,
  setCurrentEntry,
  entryFiles,
  highlight,
  entry,
  defaultWebPreviewFile,
  initState,
  rightFooter,
  schemaOptions,
  exampleGitBaseUrl,
  langAlias,
  defaultTab,
  mode = 'linked',
  webPreviewMode = 'responsive',
  designWidth = 375,
  designHeight = 812,
  fitThresholdScale = 1.0,
  fitMinScale = 0.5,
  fit = 'cover',
  deepLinkUrl,
  nativeFramework,
  _forceMobile,
}: ExampleContentProps) {
  const {
    explorerUrl,
    explorerText,
    withBase: withBaseFn = (p: string) => p,
    useI18n: useI18nHook,
    useLang: useLangHook,
    NoSSR: NoSSRComponent = DefaultNoSSR,
  } = useGoConfig();
  const LYNX_EXPLORER_URL_CN = explorerUrl?.cn || DEFAULT_EXPLORER_URL_CN;
  const LYNX_EXPLORER_URL_EN = explorerUrl?.en || DEFAULT_EXPLORER_URL_EN;
  const lynxExplorerText = explorerText || 'Lynx Explorer';

  const { treeData, doChangeExpand, selectedKeys, expandedKeys, entryData } =
    useTreeController({ fileNames, value: currentFileName, entry });
  const [showPreview, setShowPreview] = useState(mode !== 'source');
  const [showCode, setShowCode] = useState(mode !== 'preview');
  const [showFileTree, setShowFileTree] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const splitPaneRef = useRef<SplitPaneHandle>(null);
  const [isVertical, setIsVertical] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState<'off' | 'all' | 'ultra'>(
    'off',
  );
  const isUltra = fullscreenMode === 'ultra';
  const isUltraRef = useRef(false);
  isUltraRef.current = isUltra;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Freeze orientation while ultra so layout thrashing doesn't fight
        // the chromeless shell (and avoid unnecessary SplitPane work).
        if (isUltraRef.current) return;
        setIsVertical(entry.contentRect.width <= 600);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [previewType, setPreviewType] = useState(() => {
    if (defaultTab === 'preview' && previewImage) return PreviewType.Preview;
    if (defaultTab === 'qrcode') return PreviewType.QRCode;
    // 'web' can't resolve synchronously (webFile loads async); handled by useEffect below
    return previewImage ? PreviewType.Preview : PreviewType.QRCode;
  });

  // Switch to Web tab once async metadata resolves, but only if requested
  useEffect(() => {
    if (defaultTab === 'web' && defaultWebPreviewFile) {
      setPreviewType(PreviewType.Web);
    }
  }, [defaultTab, defaultWebPreviewFile]);

  const [qrcodeUrlWithSchema, setQrcodeUrlWithSchema] = useState('');
  const { hasPreview, hasWebPreview } = useMemo(() => {
    const count =
      Number(Boolean(previewImage)) +
      Number(Boolean(currentEntry)) +
      Number(Boolean(defaultWebPreviewFile));
    return {
      hasPreview: count >= 1,
      hasWebPreview: Boolean(defaultWebPreviewFile),
    };
  }, [previewImage, currentEntry, defaultWebPreviewFile]);
  const [tmpCurrentFileName, setTmpCurrentFileName] = useState('');
  const defaultI18n = (key: string) => DEFAULT_I18N[key] || key;
  const t = useI18nHook ? useI18nHook() : defaultI18n;
  const lang = useLangHook ? useLangHook() : 'en';

  // Lock body scroll while in widget fullscreen / frameless.
  // CSS class keeps <lynx-view> mounted (no remount on enter/exit).
  // Esc / browser Back: frameless → first-level fullscreen → off.
  const framelessHistRef = useRef(false);

  useEffect(() => {
    if (fullscreenMode === 'off') {
      const el = boxRef.current;
      if (el) setIsVertical(el.getBoundingClientRect().width <= 600);
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (fullscreenMode === 'ultra') {
        // Prefer history.back() so Esc and mobile Back share one exit path.
        if (framelessHistRef.current) {
          history.back();
        } else {
          setFullscreenMode('all');
        }
      } else {
        setFullscreenMode('off');
        setShowCode(true);
      }
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [fullscreenMode]);

  // Frameless: push a history entry so mobile Back / swipe-back exits safely
  // (same path as Esc on desktop). popstate → first-level fullscreen.
  useEffect(() => {
    if (fullscreenMode !== 'ultra') return;

    history.pushState({ __goFrameless: true }, '');
    framelessHistRef.current = true;

    const onPopState = () => {
      framelessHistRef.current = false;
      setFullscreenMode('all');
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      // Left frameless without Back — drop our history entry if still on top.
      if (framelessHistRef.current) {
        framelessHistRef.current = false;
        if (
          typeof history.state === 'object' &&
          history.state &&
          (history.state as { __goFrameless?: boolean }).__goFrameless
        ) {
          history.back();
        }
      }
    };
  }, [fullscreenMode]);

  const enterFrameless = () => {
    if (!hasWebPreview) return;
    setPreviewType(PreviewType.Web);
    setShowPreview(true);
    setShowCode(false);
    setFullscreenMode('ultra');
  };

  const getContainer = () => containerRef.current as HTMLDivElement;
  const onFileSelect = (v: string) => {
    setShowFileTree(false);
    updateCurrentName(v);
    if (!entryData?.find((val) => val.value === v)) {
      setTmpCurrentFileName(v);
    }
  };

  const onSwitchSchema = (schema: string) => {
    setQrcodeUrlWithSchema(schema);
  };
  // Deep-link template: an explicit `deepLinkUrl` prop overrides the framework's
  // default scheme (e.g. lynxtron → lynxtron-go://…). Universal bundles have no
  // default, so they only offer a deep link when one is passed explicitly.
  const frameworkConfig = getFrameworkConfig(nativeFramework);
  const deepLinkTemplate = deepLinkUrl || frameworkConfig?.deepLinkScheme || '';

  const resolvedDeepLinkUrl = useMemo(() => {
    if (!deepLinkTemplate) return '';
    const url = deepLinkTemplate
      .split('{{{urlEncoded}}}')
      .join(encodeURIComponent(currentEntryFileUrl))
      .split('{{{url}}}')
      .join(currentEntryFileUrl);
    // Drop dangerous schemes so a config-supplied deep link can't execute
    // in-page when clicked (e.g. `javascript:` / `data:` / `vbscript:`).
    if (/^\s*(javascript|data|vbscript):/i.test(url)) return '';
    return url;
  }, [deepLinkTemplate, currentEntryFileUrl]);
  const canOpenDeepLink = useMemo(() => {
    if (!deepLinkTemplate) return false;
    const needsUrl =
      deepLinkTemplate.includes('{{{url}}}') ||
      deepLinkTemplate.includes('{{{urlEncoded}}}');
    return needsUrl ? Boolean(currentEntryFileUrl) : true;
  }, [deepLinkTemplate, currentEntryFileUrl]);

  // The QR encodes the entry URL for universal bundles (Lynx Explorer picks it
  // up), or the resolved deep link for a framework (scanning opens that app).
  const qrcodeUrl = nativeFramework
    ? resolvedDeepLinkUrl
    : qrcodeUrlWithSchema || currentEntryFileUrl;

  const isMobileUA = useIsMobile();
  const isMobile = _forceMobile ?? isMobileUA;

  // `qrAllowed` is synchronous (depends only on `nativeFramework`), so a
  // universal bundle never transiently loses its QR tab before the entry loads.
  const qrAllowed = isQrAllowed(nativeFramework);
  const plan = useMemo(
    () =>
      resolveOpenIn({
        nativeFramework,
        isMobile,
        hasDeepLink: Boolean(deepLinkTemplate),
        hasEntry: Boolean(currentEntry),
      }),
    [nativeFramework, isMobile, deepLinkTemplate, currentEntry],
  );

  // Redirect away from the QR tab when the framework never offers one (a
  // desktop framework like Lynxtron). Gated on the synchronous `qrAllowed`, not
  // the async entry state, so a universal bundle keeps its QR tab while loading.
  useEffect(() => {
    if (previewType === PreviewType.QRCode && !qrAllowed) {
      setPreviewType(
        previewImage
          ? PreviewType.Preview
          : hasWebPreview
            ? PreviewType.Web
            : PreviewType.Preview,
      );
    }
  }, [qrAllowed]);

  // Non-QR "open" surface for desktop frameworks: the floating deep link
  // (desktop) or the "open on desktop" hint (mobile).
  const renderOpenIn = () => {
    if (qrAllowed) return null;
    if (plan.showDeepLink) {
      return (
        <FloatingDeepLink
          resolvedDeepLinkUrl={resolvedDeepLinkUrl}
          canOpenDeepLink={canOpenDeepLink}
          nativeFramework={nativeFramework}
          t={t}
        />
      );
    }
    if (plan.hintPlatform) {
      return (
        <OpenInHint
          nativeFramework={nativeFramework}
          platform={plan.hintPlatform}
          t={t}
        />
      );
    }
    return null;
  };

  const showCodeTab = entryData && entryData?.length > 1;

  const renderCodeWrap = () => (
    <div className={s['code-wrap']}>
      <div className={s['code-tab-container']}>
        {showCodeTab && (
          <div
            className={s['code-tab']}
            ref={(tabsRef) => {
              tabScrollToTop(tabsRef);
            }}
          >
            <Tabs
              activeKey={currentFileName}
              onChange={(v) => updateCurrentName(v)}
              size="small"
              preventScroll={true}
              onTabClose={() => {
                updateCurrentName(entryData[entryData.length - 1].value);
                setTmpCurrentFileName('');
              }}
            >
              {entryData.map((file) => (
                <TabPane
                  key={file.value}
                  itemKey={file.value}
                  tab={file.label}
                />
              ))}
              {tmpCurrentFileName && (
                <TabPane
                  key={tmpCurrentFileName}
                  itemKey={tmpCurrentFileName}
                  tab={tmpCurrentFileName?.split('/').pop()}
                  closable={true}
                />
              )}
            </Tabs>
          </div>
        )}
        <div
          className={`${s['code-view-container']} ${showCodeTab ? s['code-view-container-tab-show'] : ''}`}
        >
          <CodeView
            currentFileName={currentFileName}
            currentFile={currentFile}
            isAssetFile={isAssetFile}
            highlight={highlight}
            langAlias={langAlias}
          />
        </div>
      </div>
      {(mode === 'source' || !hasPreview || !showPreview) && renderOpenIn()}
    </div>
  );

  const previewOptionCount = useMemo(
    () =>
      [
        Boolean(previewImage),
        Boolean(hasWebPreview),
        Boolean(currentEntry) && qrAllowed,
      ].filter(Boolean).length,
    [previewImage, hasWebPreview, currentEntry, qrAllowed],
  );

  const renderPreviewWrap = () => (
    <div className={s['preview-wrap']}>
      <div className={s['preview-wrap-content']}>
        <div className={s['preview-header']}>
          <div style={{ width: 24, flexShrink: 0 }} />
          {/* Show the tab switcher when there's at least one preview option.
              A single option still renders it so the active tab stays
              selectable (e.g. a web-only example whose previewType would
              otherwise not match any visible panel). */}
          {previewOptionCount >= 1 ? (
            <RadioGroup
              onChange={(e) => setPreviewType(e.target.value)}
              value={previewType}
              type="button"
              style={{
                display: 'flex',
                flex: 1,
                minWidth: 0,
                justifyContent: 'center',
              }}
            >
              {initState ? (
                <>
                  {previewImage && (
                    <Radio value={PreviewType.Preview}>{t('go.preview')}</Radio>
                  )}
                  {hasWebPreview && <Radio value={PreviewType.Web}>Web</Radio>}
                  {currentEntry && qrAllowed && (
                    <Radio value={PreviewType.QRCode}>{t('go.qrcode')}</Radio>
                  )}
                </>
              ) : (
                <div style={{ width: '100%', height: '32px' }}></div>
              )}
            </RadioGroup>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          {/* First-level fullscreen: "open frameless" sits next to shrink.
              Frameless = <lynx-view> dominates the full browser viewport
              (incl. safe-area) — not OS desktop fullscreen. */}
          {fullscreenMode === 'all' && hasWebPreview && (
            <Button
              theme="borderless"
              icon={
                <IconOpenExternal
                  style={{ color: 'var(--semi-color-text-2)' }}
                />
              }
              type="tertiary"
              size="small"
              title={t('go.ultra')}
              aria-label={t('go.ultra')}
              onClick={enterFrameless}
            />
          )}
          <Button
            theme="borderless"
            icon={
              fullscreenMode !== 'off' ? (
                <IconExitFullscreen
                  style={{ color: 'var(--semi-color-text-2)' }}
                />
              ) : (
                <IconFullscreen style={{ color: 'var(--semi-color-text-2)' }} />
              )
            }
            type="tertiary"
            size="small"
            onClick={() => {
              if (fullscreenMode !== 'off') {
                setFullscreenMode('off');
                setShowCode(true);
              } else {
                splitPaneRef.current?.ensureSecondMinSize(320);
                setFullscreenMode('all');
                setShowCode(false);
              }
            }}
          />
        </div>
        <div className={s['preview-body']}>
          {previewType === PreviewType.QRCode && currentEntry && qrAllowed && (
            <div className={s['preview-panel']}>
              <div className={s.qrcode}>
                {/* Lynx-Explorer scan hint is universal-only; a framework QR
                      opens that framework's own app when scanned. */}
                {!nativeFramework && (
                  <Typography.Text
                    size="small"
                    type="tertiary"
                    style={{ margin: '28px 12px', textAlign: 'center' }}
                  >
                    {t('go.scan.message-1')}
                    <Typography.Text
                      link={{
                        href: withBaseFn(
                          lang === 'zh'
                            ? LYNX_EXPLORER_URL_CN
                            : LYNX_EXPLORER_URL_EN,
                        ),
                        target: '_blank',
                      }}
                      size="small"
                      underline
                    >
                      {lynxExplorerText}
                    </Typography.Text>{' '}
                    {t('go.scan.message-2')}
                  </Typography.Text>
                )}
                <div className={s['qrcode-svg']}>
                  <QRCodeSVG value={qrcodeUrl} />
                </div>
                <div style={{ marginBottom: '32px' }}>
                  <CopyToClipboard
                    onCopy={() => {
                      Toast.success(t('go.qrcode.copied'));
                    }}
                    text={qrcodeUrl}
                  >
                    <Button
                      type="tertiary"
                      style={{ fontSize: '12px' }}
                      icon={<IconCopyLink style={{ fontSize: '16px' }} />}
                    >
                      {t('go.qrcode.copy-link')}
                    </Button>
                  </CopyToClipboard>
                </div>
                {!nativeFramework && schemaOptions && (
                  <SwitchSchema
                    optionsData={schemaOptions}
                    currentEntryFileUrl={currentEntryFileUrl}
                    onSwitchSchema={onSwitchSchema}
                  />
                )}
                <div className={s['qrcode-entry']}>
                  <Typography.Text
                    size="small"
                    type="tertiary"
                    style={{ marginRight: '12px', flexShrink: 0 }}
                  >
                    {t('go.qrcode.entry')}
                  </Typography.Text>
                  <Select
                    style={{ width: '100%', maxWidth: '200px' }}
                    value={currentEntry}
                    onChange={(v) => setCurrentEntry(v as string)}
                  >
                    {entryFiles?.map((file) => (
                      <Select.Option key={file.name} value={file.name}>
                        {file.name}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
                {/* Additive deep link, only when the plan offers one here
                      (universal + configured, or sparkling on mobile). */}
                {plan.showDeepLink && (
                  <DeepLinkRow
                    resolvedDeepLinkUrl={resolvedDeepLinkUrl}
                    canOpenDeepLink={canOpenDeepLink}
                    nativeFramework={nativeFramework}
                    t={t}
                  />
                )}
              </div>
            </div>
          )}
          {previewImage && (
            <div
              className={s['preview-panel']}
              style={{
                zIndex: previewType === PreviewType.Preview ? 1 : 0,
                visibility:
                  previewType === PreviewType.Preview ? 'visible' : 'hidden',
                pointerEvents:
                  previewType === PreviewType.Preview ? 'auto' : 'none',
              }}
            >
              <PreviewImg
                previewImage={previewImage}
                active={previewType === PreviewType.Preview}
              />
            </div>
          )}
          {hasWebPreview && (
            <div
              className={s['preview-panel']}
              style={{
                zIndex: previewType === PreviewType.Web || isUltra ? 1 : 0,
                visibility:
                  previewType === PreviewType.Web || isUltra
                    ? 'visible'
                    : 'hidden',
                pointerEvents:
                  previewType === PreviewType.Web || isUltra ? 'auto' : 'none',
              }}
            >
              <NoSSRComponent>
                <Suspense fallback={<div>Loading...</div>}>
                  <WebIframe
                    show={previewType === PreviewType.Web || isUltra}
                    src={defaultWebPreviewFile || ''}
                    webPreviewMode={webPreviewMode}
                    designWidth={designWidth}
                    designHeight={designHeight}
                    fitThresholdScale={fitThresholdScale}
                    fitMinScale={fitMinScale}
                    fit={fit}
                  />
                </Suspense>
              </NoSSRComponent>
            </div>
          )}
        </div>
        {/* Only in the visible preview pane — renderCodeWrap() renders it when
            the preview is hidden, so the two never render at once. */}
        {showPreview && !isUltra && renderOpenIn()}
      </div>
    </div>
  );

  return (
    <div
      className={`${s.box} ${fullscreenMode !== 'off' ? s['box-fullscreen'] : ''} ${isUltra ? s['box-ultra'] : ''} ${!showCode ? s['box-code-collapsed'] : ''} ${hasPreview && !showPreview ? s['box-preview-collapsed'] : ''}`}
      ref={boxRef}
    >
      <div className={s.container} ref={containerRef}>
        <div className={s.content}>
          {mode === 'preview' ? (
            renderPreviewWrap()
          ) : mode === 'source' ? (
            renderCodeWrap()
          ) : hasPreview ? (
            <SplitPane
              ref={splitPaneRef}
              show={hasPreview}
              vertical={isVertical}
              collapsed={hasPreview && !showPreview}
              onCollapsedChange={(c) => {
                setShowPreview(!c);
                if (c && !showCode) setShowCode(true);
              }}
              firstCollapsed={hasPreview && !showCode}
              onFirstCollapsedChange={(c) => {
                setShowCode(!c);
                if (c && !showPreview) setShowPreview(true);
              }}
              first={renderCodeWrap()}
              second={renderPreviewWrap()}
            />
          ) : (
            renderCodeWrap()
          )}
        </div>
        <div className={s.footer}>
          <Space
            spacing={2}
            style={{
              maxWidth: '100%',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {mode !== 'preview' && (
              <Button
                theme="borderless"
                icon={
                  <IconList style={{ color: 'var(--semi-color-text-2)' }} />
                }
                type="tertiary"
                size="small"
                onClick={() => setShowFileTree(true)}
              />
            )}
            <Space spacing={2} style={{ overflow: 'hidden' }}>
              <Typography.Text
                size="small"
                type="tertiary"
                ellipsis={{ showTooltip: true }}
              >
                {name}
              </Typography.Text>
              {mode !== 'preview' && (
                <>
                  <IconChevronRightStroked
                    style={{
                      color: 'var(--semi-color-text-2)',
                      fontSize: '12px',
                    }}
                  />
                  <Typography.Text
                    size="small"
                    type="tertiary"
                    ellipsis={{ showTooltip: true }}
                  >
                    {currentFileName}
                  </Typography.Text>
                </>
              )}
            </Space>
          </Space>
          <Space spacing={7}>
            {mode !== 'preview' && (
              <Button
                theme="borderless"
                icon={
                  <IconGithub style={{ color: 'var(--semi-color-text-2)' }} />
                }
                type="tertiary"
                size="small"
                onClick={() => {
                  window.open(
                    `${exampleGitBaseUrl}/${directory}/${currentFileName}`,
                    '_blank',
                  );
                }}
              />
            )}
            {hasPreview && mode === 'linked' && (
              <Space spacing={6}>
                <Typography.Text
                  size="small"
                  type="tertiary"
                  className={s['toggle-label']}
                >
                  Code
                </Typography.Text>
                <Switch
                  style={{
                    backgroundColor: showCode
                      ? 'var(--semi-color-info)'
                      : 'var(--semi-color-fill-0)',
                    cursor: 'pointer',
                  }}
                  checked={showCode}
                  onChange={(checked) => {
                    setShowCode(checked);
                    if (!checked && !showPreview) setShowPreview(true);
                  }}
                  size="small"
                />
              </Space>
            )}
            {hasPreview && mode === 'linked' && (
              <Space spacing={6}>
                <Typography.Text
                  size="small"
                  type="tertiary"
                  className={s['toggle-label']}
                >
                  {t('go.preview')}
                </Typography.Text>
                <Switch
                  style={{
                    backgroundColor: showPreview
                      ? 'var(--semi-color-info)'
                      : 'var(--semi-color-fill-0)',
                    cursor: 'pointer',
                  }}
                  checked={showPreview}
                  onChange={(v) => {
                    setShowPreview(v);
                    if (!v && !showCode) setShowCode(true);
                  }}
                  size="small"
                />
              </Space>
            )}
            {mode !== 'preview' &&
              fullscreenMode === 'all' &&
              hasWebPreview && (
                <Button
                  theme="borderless"
                  icon={
                    <IconOpenExternal
                      style={{ color: 'var(--semi-color-text-2)' }}
                    />
                  }
                  type="tertiary"
                  size="small"
                  title={t('go.ultra')}
                  aria-label={t('go.ultra')}
                  onClick={enterFrameless}
                />
              )}
            {mode !== 'preview' && (
              <Button
                theme="borderless"
                icon={
                  fullscreenMode !== 'off' ? (
                    <IconExitFullscreen
                      style={{ color: 'var(--semi-color-text-2)' }}
                    />
                  ) : (
                    <IconFullscreen
                      style={{ color: 'var(--semi-color-text-2)' }}
                    />
                  )
                }
                type="tertiary"
                size="small"
                onClick={() => {
                  if (fullscreenMode !== 'off') {
                    setFullscreenMode('off');
                    setShowCode(true);
                  } else {
                    splitPaneRef.current?.ensureSecondMinSize(320);
                    setFullscreenMode('all');
                  }
                }}
              />
            )}
            {rightFooter}
          </Space>
        </div>
        <SideSheet
          width={224}
          placement="left"
          visible={showFileTree}
          onCancel={() => setShowFileTree(false)}
          getPopupContainer={getContainer}
          closeIcon={null}
          closable={false}
          title={<Typography.Text>{t('go.files')}</Typography.Text>}
          headerStyle={{
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            padding: '12px 24px',
            fontSize: '16px',
            borderBottom: '1px solid var(--semi-color-border)',
          }}
          bodyStyle={{
            padding: '12px',
          }}
        >
          <FileTree
            onSelect={onFileSelect}
            entry={entry}
            treeData={treeData}
            doChangeExpand={doChangeExpand}
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
          />
        </SideSheet>
      </div>
    </div>
  );
}
