import { Tooltip } from '@douyinfe/semi-ui';
import { translateGoI18n, useGoConfig } from '../../config';
import { getExampleVersionText } from '../utils/example-version';
import s from './index.module.scss';

type ExampleVersionProps = {
  version?: string;
  getPopupContainer?: () => HTMLElement;
};

export function ExampleVersion({
  version,
  getPopupContainer,
}: ExampleVersionProps) {
  const { useLang, i18n } = useGoConfig();
  const lang = useLang?.() ?? 'en';
  const label = translateGoI18n('go.example.version.label', lang, i18n);
  const text = getExampleVersionText(version, label);
  if (!text) return null;
  const descriptionLabel = translateGoI18n(
    'go.example.version.description',
    lang,
    i18n,
  );
  const description = (
    <>
      {descriptionLabel}
      {descriptionLabel ? ' ' : null}
      {version}
    </>
  );

  return (
    <Tooltip
      content={<div className={s['footer-version-tooltip']}>{description}</div>}
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
