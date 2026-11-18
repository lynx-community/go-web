import { Tooltip } from '@douyinfe/semi-ui';
import type React from 'react';
import { translateGoI18n, useGoConfig } from '../../config';
import {
  DEFAULT_VERSION_LABEL,
  getExampleVersionText,
} from '../utils/example-version';
import s from './index.module.scss';

type ExampleVersionProps = {
  version?: string;
  versionLabel?: string;
  getPopupContainer?: () => HTMLElement;
};

function ExampleVersion({
  version,
  versionLabel,
  getPopupContainer,
}: ExampleVersionProps) {
  const { useLang, i18n, versionLabel: configVersionLabel } = useGoConfig();
  const lang = useLang?.() ?? 'en';
  const label = versionLabel ?? configVersionLabel ?? DEFAULT_VERSION_LABEL;
  const text = getExampleVersionText(version, label);
  if (!text) return null;
  const description = getExampleVersionText(
    version,
    translateGoI18n('go.example.version', lang, i18n),
  );

  return (
    <Tooltip
      content={description ?? text}
      position="topLeft"
      spacing={8}
      getPopupContainer={getPopupContainer}
    >
      <span className={`${s['footer-text']} ${s['footer-version']}`}>
        <span className={s['footer-version-description']}>{description}</span>
        <span aria-hidden="true" className={s['footer-version-label']}>
          {label}
        </span>
        <span aria-hidden="true" className={s['footer-version-number']}>
          {version}
        </span>
      </span>
    </Tooltip>
  );
}

type ExampleFooterProps = ExampleVersionProps & {
  content?: React.ReactNode;
};

/** Explicit content replaces the default, including null/false to hide it. */
export function ExampleFooter({
  version,
  versionLabel,
  content,
  getPopupContainer,
}: ExampleFooterProps) {
  if (content === undefined) {
    return (
      <ExampleVersion
        version={version}
        versionLabel={versionLabel}
        getPopupContainer={getPopupContainer}
      />
    );
  }
  if (typeof content === 'string') {
    return content ? (
      <span className={s['footer-text']} title={content}>
        {content}
      </span>
    ) : null;
  }
  return <>{content}</>;
}
