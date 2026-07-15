import { Typography } from '@douyinfe/semi-ui';
import type { FrameworkPlatform } from '../utils/native-frameworks';
import { getFrameworkConfig } from '../utils/native-frameworks';

import s from './open-in-panel.module.scss';

interface DeepLinkProps {
  resolvedDeepLinkUrl: string;
  canOpenDeepLink: boolean;
  nativeFramework: string | undefined;
  t: (key: string) => string;
}

function deepLinkLabelKey(nativeFramework: string | undefined): string {
  return `go.deeplink.open.${nativeFramework || 'default'}`;
}

// The single deep-link affordance — one bordered link, used everywhere it
// appears (appended inside the QR tab, or floating for a desktop framework), so
// the "open in app" action always reads the same.
function DeepLinkLink({
  resolvedDeepLinkUrl,
  canOpenDeepLink,
  nativeFramework,
  t,
}: DeepLinkProps) {
  if (!resolvedDeepLinkUrl) return null;
  const disabled = !canOpenDeepLink;
  return (
    <a
      className={s['open-link']}
      // Drop the href when disabled so it isn't activatable and leaves the tab
      // order; `aria-disabled` conveys the state to assistive tech.
      href={disabled ? undefined : resolvedDeepLinkUrl}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      data-disabled={disabled || undefined}
    >
      {t(deepLinkLabelKey(nativeFramework))} &#x2197;
    </a>
  );
}

// ─── Additive deep-link row ──────────────────────────────────────────────────
// Appended inside the QR tab when a deep link is available:
//
//     —— or ——
//     Open in … ↗

export function DeepLinkRow(props: DeepLinkProps) {
  if (!props.resolvedDeepLinkUrl) return null;
  return (
    <div className={s['deeplink-row']}>
      <div className={s['deeplink-divider']} aria-hidden="true">
        <span className={s['deeplink-divider-line']} />
        <span className={s['deeplink-divider-text']}>
          {props.t('go.deeplink.or')}
        </span>
        <span className={s['deeplink-divider-line']} />
      </div>
      <DeepLinkLink {...props} />
    </div>
  );
}

// ─── Floating deep link ──────────────────────────────────────────────────────
// A desktop framework (e.g. Lynxtron) has no QR path, so the deep link floats
// bottom-right over the code / preview.

export function FloatingDeepLink(props: DeepLinkProps) {
  if (!props.resolvedDeepLinkUrl) return null;
  return (
    <div className={s['floating-toast']}>
      <DeepLinkLink {...props} />
    </div>
  );
}

// ─── Can't-run-here hint ─────────────────────────────────────────────────────
// The bundle needs a framework that can't run on this device (e.g. Lynxtron on
// a phone). Name the framework and, when the registry provides a `learnMoreUrl`,
// link to its docs; otherwise show plain text.

export function OpenInHint({
  nativeFramework,
  platform,
  t,
}: {
  nativeFramework: string | undefined;
  platform: FrameworkPlatform;
  t: (key: string) => string;
}) {
  const config = getFrameworkConfig(nativeFramework);
  const appName = config?.appName ?? nativeFramework ?? '';
  const qualifier = t(`go.deeplink.hint-${platform}`);
  const label = appName ? `${appName} · ${qualifier}` : qualifier;

  return (
    <div className={s['floating-toast']}>
      {config?.learnMoreUrl ? (
        <a
          className={s['open-link']}
          href={config.learnMoreUrl}
          target="_blank"
          rel="noreferrer"
        >
          {label} &#x2197;
        </a>
      ) : (
        <Typography.Text
          size="small"
          type="tertiary"
          className={s['open-hint']}
        >
          {label}
        </Typography.Text>
      )}
    </div>
  );
}
