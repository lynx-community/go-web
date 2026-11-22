import { Typography } from '@douyinfe/semi-ui';
import { useEffect, useRef, useState } from 'react';
import type {
  FrameworkPlatform,
  NativeFrameworkConfig,
} from '../utils/native-frameworks';

import s from './open-in-panel.module.scss';

const FALLBACK_DELAY_MS = 500;

interface DeepLinkProps {
  resolvedDeepLinkUrl: string;
  canOpenDeepLink: boolean;
  nativeFramework: string | undefined;
  /**
   * The framework's `downloadUrl`, already resolved for the current language.
   * Shown after the first open attempt so users have an immediate fallback.
   */
  downloadUrl?: string;
  t: (key: string) => string;
}

function deepLinkLabelKey(nativeFramework: string | undefined): string {
  return `go.deeplink.open.${nativeFramework || 'default'}`;
}

function downloadLabelKey(nativeFramework: string | undefined): string {
  return `go.deeplink.download.${nativeFramework || 'default'}`;
}

// The single deep-link affordance — one bordered link, used everywhere it
// appears (appended inside the QR tab, or floating for a desktop framework), so
// the "open in app" action always reads the same.
//
// The download URL is revealed shortly after the first open attempt. The
// web platform cannot reliably tell whether a desktop protocol handler opened,
// so a short fixed delay gives the launch action visible precedence without
// making users wait for an unreliable failure probe. The open action remains
// available beside it for retries.
function DeepLinkLink({
  resolvedDeepLinkUrl,
  canOpenDeepLink,
  nativeFramework,
  downloadUrl,
  t,
}: DeepLinkProps) {
  const [attempted, setAttempted] = useState(false);
  const fallbackTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    },
    [],
  );
  if (!resolvedDeepLinkUrl) return null;
  const disabled = !canOpenDeepLink;

  return (
    <span className={s['open-link-group']}>
      <a
        className={s['open-link']}
        // Drop the href when disabled so it isn't activatable and leaves the tab
        // order; `aria-disabled` conveys the state to assistive tech.
        href={disabled ? undefined : resolvedDeepLinkUrl}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          // Let the browser do the navigation — a manual `location.href` would
          // break middle-click and modifier-click. Reveal the fallback after a
          // brief beat; the browser cannot reliably report whether the custom
          // scheme opened.
          if (downloadUrl) {
            if (fallbackTimerRef.current !== null) {
              window.clearTimeout(fallbackTimerRef.current);
            }
            fallbackTimerRef.current = window.setTimeout(() => {
              setAttempted(true);
              fallbackTimerRef.current = null;
            }, FALLBACK_DELAY_MS);
          }
        }}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        data-disabled={disabled || undefined}
      >
        {t(deepLinkLabelKey(nativeFramework))} &#x2197;
      </a>
      {attempted && downloadUrl ? (
        <a
          className={s['open-link']}
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          data-fallback="true"
        >
          {t(downloadLabelKey(nativeFramework))} &#x2197;
        </a>
      ) : null}
    </span>
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
