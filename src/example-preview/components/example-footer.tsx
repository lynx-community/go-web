import type React from 'react';
import { translateGoI18n, useGoConfig } from '../../config';
import { getExampleVersionText } from '../utils/example-version';
import s from './index.module.scss';

function ExampleVersion({ version }: { version?: string }) {
  const { useLang, i18n } = useGoConfig();
  const lang = useLang?.() ?? 'en';
  const label = translateGoI18n('go.example.version', lang, i18n);
  const text = getExampleVersionText(version, lang, label);
  if (!text) return null;

  return (
    <span title={text} className={`${s['footer-text']} ${s['footer-version']}`}>
      <span className={s['footer-version-label']}>{label}</span>
      <span className={s['footer-version-number']}>{version}</span>
    </span>
  );
}

/** An explicit footer replaces the default, including null/false to hide it. */
export function ExampleFooter({
  version,
  rightFooter,
}: {
  version?: string;
  rightFooter?: React.ReactNode;
}) {
  if (rightFooter === undefined) return <ExampleVersion version={version} />;
  if (typeof rightFooter === 'string') {
    return rightFooter ? (
      <span className={s['footer-text']} title={rightFooter}>
        {rightFooter}
      </span>
    ) : null;
  }
  return <>{rightFooter}</>;
}
