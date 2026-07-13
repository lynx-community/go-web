import { Select, Toast, Typography } from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';
import React, { useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import type { SchemaOptionsData } from '../hooks/use-switch-schema';
import { IconCopyLink } from '../utils/icon';
import { SwitchSchema } from './switch-schema';

import s from './open-in-panel.module.scss';

export type OpenInPanelVariant = 'tab' | 'bottom-sheet' | 'floating-toast';

export interface OpenInPanelProps {
  variant: OpenInPanelVariant;

  // QR code data
  qrcodeUrl: string;
  currentEntry: string;
  entryFiles?: { name: string; file: string }[];
  setCurrentEntry: (v: string) => void;
  schemaOptions?: SchemaOptionsData;
  currentEntryFileUrl: string;
  onSwitchSchema: (schema: string) => void;

  // Deep link
  resolvedDeepLinkUrl: string;
  canOpenDeepLink: boolean;

  // Explorer info
  explorerUrl: string;
  lynxExplorerText: string;

  // Flags
  hasEntry: boolean;
  /**
   * Native framework this bundle depends on at runtime (e.g. `"lynxtron"`).
   * Drives which i18n key is used for the button label. Undefined = universal
   * (no native dep) → `go.deeplink.open.default`.
   */
  nativeFramework: string | undefined;

  // i18n + utils
  t: (key: string) => string;
  withBaseFn: (path: string) => string;
}

function deepLinkLabelKey(nativeFramework: string | undefined): string {
  return `go.deeplink.open.${nativeFramework || 'default'}`;
}

function DeepLinkAction({
  resolvedDeepLinkUrl,
  canOpenDeepLink,
  nativeFramework,
  t,
}: {
  resolvedDeepLinkUrl: string;
  canOpenDeepLink: boolean;
  nativeFramework: string | undefined;
  t: (key: string) => string;
}) {
  if (!resolvedDeepLinkUrl) return null;
  return (
    <a
      className={s['open-link']}
      href={resolvedDeepLinkUrl}
      onClick={(e) => {
        if (!canOpenDeepLink) e.preventDefault();
      }}
      data-disabled={!canOpenDeepLink || undefined}
    >
      {t(deepLinkLabelKey(nativeFramework))}
      <span className={s['open-link-arrow']}>&#x2197;</span>
    </a>
  );
}

// ─── Tab variant (Desktop) ───────────────────────────────────────────────────
// Vertical centered: QR → copy → entry → scan hint → divider → deep link

function TabContent(props: OpenInPanelProps) {
  const {
    qrcodeUrl,
    currentEntry,
    entryFiles,
    setCurrentEntry,
    schemaOptions,
    currentEntryFileUrl,
    onSwitchSchema,
    resolvedDeepLinkUrl,
    canOpenDeepLink,
    explorerUrl,
    lynxExplorerText,
    nativeFramework,
    t,
    withBaseFn,
  } = props;

  return (
    <div className={s.tab}>
      <div className={s['tab-body']}>
        {/* QR section */}
        <div className={s['tab-qr-frame']}>
          <QRCodeSVG value={qrcodeUrl} size={140} />
        </div>
        <CopyToClipboard
          onCopy={() => Toast.success(t('go.qrcode.copied'))}
          text={qrcodeUrl}
        >
          <button type="button" className={s['copy-btn']}>
            <IconCopyLink style={{ fontSize: '14px' }} />
            {t('go.qrcode.copy-link')}
          </button>
        </CopyToClipboard>

        {/* Entry selector */}
        {entryFiles && entryFiles.length > 1 && (
          <div className={s['entry-row']}>
            <Typography.Text
              size="small"
              type="tertiary"
              style={{ flexShrink: 0 }}
            >
              {t('go.qrcode.entry')}
            </Typography.Text>
            <Select
              size="small"
              style={{ width: '100%', maxWidth: '180px' }}
              value={currentEntry}
              onChange={(v) => setCurrentEntry(v as string)}
            >
              {entryFiles.map((file) => (
                <Select.Option key={file.name} value={file.name}>
                  {file.name}
                </Select.Option>
              ))}
            </Select>
          </div>
        )}

        {/* Scan hint */}
        <Typography.Text
          size="small"
          type="tertiary"
          className={s['tab-scan-hint']}
        >
          {t('go.scan.message-1')}
          <Typography.Text
            link={{ href: withBaseFn(explorerUrl), target: '_blank' }}
            size="small"
            underline
          >
            {lynxExplorerText}
          </Typography.Text>{' '}
          {t('go.scan.message-2')}
        </Typography.Text>

        {/* Schema switcher */}
        {schemaOptions && (
          <SwitchSchema
            optionsData={schemaOptions}
            currentEntryFileUrl={currentEntryFileUrl}
            onSwitchSchema={onSwitchSchema}
          />
        )}

        {/* Deep link at bottom */}
        {resolvedDeepLinkUrl && (
          <>
            <div className={s['tab-divider']}>
              <span className={s['tab-divider-line']} />
              <Typography.Text size="small" type="tertiary">
                or
              </Typography.Text>
              <span className={s['tab-divider-line']} />
            </div>
            <DeepLinkAction
              resolvedDeepLinkUrl={resolvedDeepLinkUrl}
              canOpenDeepLink={canOpenDeepLink}
              nativeFramework={nativeFramework}
              t={t}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Bottom-sheet variant (Mobile) ───────────────────────────────────────────
// Folded: "Open in X ↗" left + "▸ QR" right
// Unfolded: QR left + actions right, deep link moves to footer row

function BottomSheetContent(props: OpenInPanelProps) {
  const {
    nativeFramework,
    resolvedDeepLinkUrl,
    canOpenDeepLink,
    hasEntry,
    qrcodeUrl,
    currentEntry,
    entryFiles,
    setCurrentEntry,
    t,
  } = props;

  const [qrExpanded, setQrExpanded] = useState(false);

  // Bundle needs a native framework (e.g. Lynxtron) → mobile Lynx Explorer can't
  // scan it. Show a hint instead of the QR/deep-link folded row.
  if (nativeFramework) {
    return (
      <div className={s['bottom-sheet']}>
        <Typography.Text size="small" type="tertiary">
          {t('go.deeplink.hint-desktop')}
        </Typography.Text>
      </div>
    );
  }

  return (
    <div className={s['bottom-sheet']}>
      {!qrExpanded ? (
        /* ── Folded: deep link left, QR toggle right ── */
        <div className={s['bs-row']}>
          <DeepLinkAction
            resolvedDeepLinkUrl={resolvedDeepLinkUrl}
            canOpenDeepLink={canOpenDeepLink}
            nativeFramework={nativeFramework}
            t={t}
          />
          {hasEntry && qrcodeUrl && (
            <button
              type="button"
              className={s['qr-toggle']}
              onClick={() => setQrExpanded(true)}
            >
              <Typography.Text size="small" type="tertiary">
                ▸ QR
              </Typography.Text>
            </button>
          )}
        </div>
      ) : (
        /* ── Unfolded: QR panel + deep link footer ── */
        <>
          <div className={s['bs-row']}>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className={s['qr-toggle']}
              onClick={() => setQrExpanded(false)}
            >
              <Typography.Text size="small" type="tertiary">
                ▾ QR
              </Typography.Text>
            </button>
          </div>
          <div className={s['bs-qr-panel']}>
            <div className={s['qr-frame-small']}>
              <QRCodeSVG value={qrcodeUrl} size={100} />
            </div>
            <div className={s['bs-qr-actions']}>
              <CopyToClipboard
                onCopy={() => Toast.success(t('go.qrcode.copied'))}
                text={qrcodeUrl}
              >
                <button type="button" className={s['copy-btn']}>
                  <IconCopyLink style={{ fontSize: '13px' }} />
                  {t('go.qrcode.copy-link')}
                </button>
              </CopyToClipboard>
              {entryFiles && entryFiles.length > 1 && (
                <div className={s['entry-row']}>
                  <Typography.Text
                    size="small"
                    type="tertiary"
                    style={{ flexShrink: 0 }}
                  >
                    {t('go.qrcode.entry')}
                  </Typography.Text>
                  <Select
                    size="small"
                    style={{ width: '100%', maxWidth: '140px' }}
                    value={currentEntry}
                    onChange={(v) => setCurrentEntry(v as string)}
                  >
                    {entryFiles.map((file) => (
                      <Select.Option key={file.name} value={file.name}>
                        {file.name}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </div>
          <div className={s['bs-footer']}>
            <DeepLinkAction
              resolvedDeepLinkUrl={resolvedDeepLinkUrl}
              canOpenDeepLink={canOpenDeepLink}
              nativeFramework={nativeFramework}
              t={t}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Floating toast ──────────────────────────────────────────────────────────

function FloatingToastContent(props: OpenInPanelProps) {
  const { resolvedDeepLinkUrl, canOpenDeepLink, nativeFramework, t } = props;
  if (!resolvedDeepLinkUrl) return null;
  return (
    <div className={s['floating-toast']}>
      <a
        className={s['open-link-float']}
        href={resolvedDeepLinkUrl}
        onClick={(e) => {
          if (!canOpenDeepLink) e.preventDefault();
        }}
        data-disabled={!canOpenDeepLink || undefined}
      >
        {t(deepLinkLabelKey(nativeFramework))} &#x2197;
      </a>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function OpenInPanel(props: OpenInPanelProps) {
  switch (props.variant) {
    case 'tab':
      return <TabContent {...props} />;
    case 'bottom-sheet':
      return <BottomSheetContent {...props} />;
    case 'floating-toast':
      return <FloatingToastContent {...props} />;
    default:
      return null;
  }
}
