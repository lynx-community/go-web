import { Button, Select, Toast, Typography } from '@douyinfe/semi-ui';
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
  bundleType: 'lynx' | 'lynxtron';

  // i18n + utils
  t: (key: string) => string;
  withBaseFn: (path: string) => string;
}

// ─── Tab variant ─────────────────────────────────────────────────────────────

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
    t,
    withBaseFn,
  } = props;

  return (
    <div className={s.tab}>
      <div className={s['tab-content']}>
        <div className={s['tab-qr-section']}>
          <div className={s['tab-qr-frame']}>
            <QRCodeSVG value={qrcodeUrl} size={140} />
          </div>
          <div className={s['tab-qr-actions']}>
            <CopyToClipboard
              onCopy={() => Toast.success(t('go.qrcode.copied'))}
              text={qrcodeUrl}
            >
              <Button
                type="tertiary"
                size="small"
                icon={<IconCopyLink style={{ fontSize: '14px' }} />}
                style={{ fontSize: '11px' }}
              >
                {t('go.qrcode.copy-link')}
              </Button>
            </CopyToClipboard>
          </div>
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
        </div>

        {resolvedDeepLinkUrl && (
          <div className={s['tab-deeplink-section']}>
            <div className={s['tab-divider']}>
              <span className={s['tab-divider-line']} />
              <Typography.Text size="small" type="tertiary">
                or
              </Typography.Text>
              <span className={s['tab-divider-line']} />
            </div>
            <a
              className={s['open-link']}
              href={resolvedDeepLinkUrl}
              onClick={(e) => {
                if (!canOpenDeepLink) e.preventDefault();
              }}
              data-disabled={!canOpenDeepLink || undefined}
            >
              {t('go.deeplink.open')} <span className={s['open-link-arrow']}>&#x2197;</span>
            </a>
          </div>
        )}
      </div>

      <div className={s['tab-footer']}>
        {schemaOptions && (
          <SwitchSchema
            optionsData={schemaOptions}
            currentEntryFileUrl={currentEntryFileUrl}
            onSwitchSchema={onSwitchSchema}
          />
        )}
        <div className={s['tab-entry']}>
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
            {entryFiles?.map((file) => (
              <Select.Option key={file.name} value={file.name}>
                {file.name}
              </Select.Option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}

// ─── Bottom-sheet variant ────────────────────────────────────────────────────

function BottomSheetContent(props: OpenInPanelProps) {
  const {
    bundleType,
    resolvedDeepLinkUrl,
    canOpenDeepLink,
    hasEntry,
    qrcodeUrl,
    t,
  } = props;

  const [qrExpanded, setQrExpanded] = useState(false);

  if (bundleType === 'lynxtron') {
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
      <div className={s['bottom-sheet-row']}>
        {resolvedDeepLinkUrl && (
          <a
            className={s['open-link']}
            href={resolvedDeepLinkUrl}
            onClick={(e) => {
              if (!canOpenDeepLink) e.preventDefault();
            }}
            data-disabled={!canOpenDeepLink || undefined}
          >
            {t('go.deeplink.open')} <span className={s['open-link-arrow']}>&#x2197;</span>
          </a>
        )}
        {hasEntry && qrcodeUrl && (
          <button
            type="button"
            className={s['qr-toggle']}
            onClick={() => setQrExpanded((v) => !v)}
          >
            <Typography.Text size="small" type="tertiary">
              {qrExpanded ? '▾' : '▸'} QR
            </Typography.Text>
          </button>
        )}
      </div>
      {qrExpanded && hasEntry && qrcodeUrl && (
        <div className={s['qr-expanded']}>
          <QRCodeSVG value={qrcodeUrl} size={100} />
          <CopyToClipboard
            onCopy={() => Toast.success(t('go.qrcode.copied'))}
            text={qrcodeUrl}
          >
            <Button
              type="tertiary"
              size="small"
              style={{ fontSize: '11px', marginTop: '6px' }}
              icon={<IconCopyLink style={{ fontSize: '13px' }} />}
            >
              {t('go.qrcode.copy-link')}
            </Button>
          </CopyToClipboard>
        </div>
      )}
    </div>
  );
}

// ─── Floating toast variant ──────────────────────────────────────────────────

function FloatingToastContent(props: OpenInPanelProps) {
  const { resolvedDeepLinkUrl, canOpenDeepLink, t } = props;
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
        {t('go.deeplink.open')} &#x2197;
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
