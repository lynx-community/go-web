import { Typography } from '@douyinfe/semi-ui';
import type {
  FrameworkPlatform,
  NativeFrameworkConfig,
} from '../utils/native-frameworks';

import s from './open-in-panel.module.scss';

interface DeepLinkProps {
  resolvedDeepLinkUrl: string;
  canOpenDeepLink: boolean;
  nativeFramework: string | undefined;
  /**
   * Registry entry merged with the site's overrides, already resolved for the
   * current language. Undefined for a universal bundle.
   */
  frameworkConfig?: NativeFrameworkConfig;
  /** `frameworkConfig.downloadUrl` resolved for the current language. */
  downloadUrl?: string;
  t: (key: string) => string;
}

function deepLinkLabelKey(nativeFramework: string | undefined): string {
  return `go.deeplink.open.${nativeFramework || 'default'}`;
}

function downloadLabelKey(nativeFramework: string | undefined): string {
  return `go.deeplink.download.${nativeFramework || 'default'}`;
}

// A deep link to an app you don't have installed fails silently — the browser
// swallows it and nothing happens. When the site tells us where to get the app,
// offer that as a quieter second line so the dead click has a way out.
function DownloadLink({
  downloadUrl,
  nativeFramework,
  t,
}: Pick<DeepLinkProps, 'downloadUrl' | 'nativeFramework' | 't'>) {
  if (!downloadUrl) return null;
  return (
    <a
      className={s['download-link']}
      href={downloadUrl}
      target="_blank"
      rel="noreferrer"
    >
      {t(downloadLabelKey(nativeFramework))}
    </a>
  );
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
      <DownloadLink {...props} />
    </div>
  );
}

// ─── Floating deep link ──────────────────────────────────────────────────────
// A desktop framework (e.g. Lynxtron) has no QR path, so the deep link floats
// bottom-right over the code / preview, with the download fallback under it.

export function FloatingDeepLink(props: DeepLinkProps) {
  if (!props.resolvedDeepLinkUrl) return null;
  return (
    <div className={s['floating-toast']}>
      <div className={s['floating-stack']}>
        <DeepLinkLink {...props} />
        <DownloadLink {...props} />
      </div>
    </div>
  );
}

// ─── Can't-run-here hint ─────────────────────────────────────────────────────
// The bundle needs a framework that can't run on this device (e.g. Lynxtron on
// a phone). Name the framework and, when the site supplies a `learnMoreUrl`,
// link to it — that's the only actionable thing a phone visitor can do with a
// desktop-only bundle. Without one it stays plain text.

export function OpenInHint({
  nativeFramework,
  frameworkConfig,
  learnMoreUrl,
  platform,
  t,
}: {
  nativeFramework: string | undefined;
  frameworkConfig?: NativeFrameworkConfig;
  /** `frameworkConfig.learnMoreUrl` resolved for the current language. */
  learnMoreUrl?: string;
  platform: FrameworkPlatform;
  t: (key: string) => string;
}) {
  const appName = frameworkConfig?.appName ?? nativeFramework ?? '';
  const qualifier = t(`go.deeplink.hint-${platform}`);
  const label = appName ? `${appName} · ${qualifier}` : qualifier;

  return (
    <div className={s['floating-toast']}>
      {learnMoreUrl ? (
        <a
          className={s['open-link']}
          href={learnMoreUrl}
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
