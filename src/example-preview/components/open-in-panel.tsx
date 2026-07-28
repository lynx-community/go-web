import { Typography } from '@douyinfe/semi-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FrameworkPlatform,
  NativeFrameworkConfig,
} from '../utils/native-frameworks';

import s from './open-in-panel.module.scss';

/**
 * How long to wait after navigating to the deep link before deciding the host
 * app isn't installed. Generous on purpose: the OS may show a "Open Lynxtron
 * Go?" confirmation dialog, and the user has to read and click it before the
 * tab loses focus. Too short and we tell someone who *does* have the app to go
 * download it.
 */
const PROBE_TIMEOUT_MS = 5000;

/**
 * Upper bound on a *trustworthy* probe. Background tabs get their timers
 * throttled, so a callback firing far past its deadline means the tab was
 * suspended and came back — we learned nothing about the app, and guessing
 * would be worse than staying quiet.
 */
const PROBE_MAX_ELAPSED_MS = 8000;

interface DeepLinkProps {
  resolvedDeepLinkUrl: string;
  canOpenDeepLink: boolean;
  nativeFramework: string | undefined;
  /**
   * The framework's `downloadUrl`, already resolved for the current language.
   * Shown only after an unanswered click; absent means no probing.
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

/**
 * Did the deep link launch anything?
 *
 * The web platform gives no way to ask whether a protocol handler is
 * registered — `registerProtocolHandler` only registers, and
 * `getInstalledRelatedApps()` covers PWAs and app-declared associations, not a
 * third-party desktop app. So we infer it: if the app launches, the OS takes
 * focus and the tab goes hidden or blurred. Still visible after the timeout —
 * nothing handled it.
 *
 * Deliberately one-way: we only ever conclude "not installed", never
 * "installed", because a false "not installed" costs a stale hint while a false
 * "installed" would hide the only way out of a dead click.
 */
function useDeepLinkProbe(): {
  /** True once a click has gone unanswered — show the download fallback. */
  unanswered: boolean;
  probe: () => void;
} {
  const [unanswered, setUnanswered] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // A probe outliving its component would setState on an unmounted tree.
  useEffect(() => () => cleanupRef.current?.(), []);

  const probe = useCallback(() => {
    cleanupRef.current?.();
    const start = Date.now();
    let settled = false;

    const cleanup = () => {
      settled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.clearTimeout(timer);
      cleanupRef.current = null;
    };
    // Either signal means the OS took over: the app is there, stay quiet.
    const onVisibility = () => {
      if (document.hidden) cleanup();
    };
    const onBlur = () => cleanup();

    const timer = window.setTimeout(() => {
      if (settled) return;
      const elapsed = Date.now() - start;
      cleanup();
      if (elapsed < PROBE_MAX_ELAPSED_MS && !document.hidden) {
        setUnanswered(true);
      }
    }, PROBE_TIMEOUT_MS);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    cleanupRef.current = cleanup;
  }, []);

  return { unanswered, probe };
}

// The single deep-link affordance — one bordered link, used everywhere it
// appears (appended inside the QR tab, or floating for a desktop framework), so
// the "open in app" action always reads the same.
//
// The download URL is not shown up front. A deep link that works needs no
// download prompt, and showing one next to every button reads as "this probably
// won't work". Instead the click itself is the test: if nothing answers it, the
// link is replaced in place by the way out.
function DeepLinkLink({
  resolvedDeepLinkUrl,
  canOpenDeepLink,
  nativeFramework,
  downloadUrl,
  t,
}: DeepLinkProps) {
  const { unanswered, probe } = useDeepLinkProbe();
  if (!resolvedDeepLinkUrl) return null;
  const disabled = !canOpenDeepLink;

  if (unanswered && downloadUrl) {
    return (
      <a
        className={s['open-link']}
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        data-fallback="true"
      >
        {t(downloadLabelKey(nativeFramework))} &#x2197;
      </a>
    );
  }

  return (
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
        // break middle-click and modifier-click. We only start the timer.
        if (downloadUrl) probe();
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
