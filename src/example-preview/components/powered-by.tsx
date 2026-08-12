import { Tooltip } from '@douyinfe/semi-ui';

import s from './powered-by.module.scss';

/** Where someone goes to put this component on their own site. */
export const GO_WEB_REPO_URL = 'https://github.com/lynx-community/go-web';

interface PoweredByGoProps {
  /**
   * `GoConfig.poweredBy` — `false` removes the mark, a string points it
   * somewhere other than the public repo.
   */
  poweredBy?: boolean | string;
  t: (key: string) => string;
  /** Keep the tooltip inside the widget so fullscreen doesn't bury it. */
  getPopupContainer?: () => HTMLElement;
}

/**
 * The one place the widget names itself: a `<Go/>` mark in the footer's left
 * corner, invisible at rest and revealed while the pointer is anywhere inside
 * the widget.
 *
 * The footer's GitHub button already links out — but to *this example's*
 * source, which is what a reader wants and not at all what someone who wants
 * the surrounding widget is looking for. That reader currently has nowhere to
 * click: the code pane, the live preview and the QR tab are all evidently
 * *something*, and nothing on screen says what. The mark closes that gap
 * without spending any of the resting composition on it — a reader who is only
 * reading never sees it, and the one who wonders "what is this thing" is
 * already hovering by the time they wonder.
 */
export function PoweredByGo({
  poweredBy,
  t,
  getPopupContainer,
}: PoweredByGoProps) {
  if (poweredBy === false) return null;

  const href = typeof poweredBy === 'string' ? poweredBy : GO_WEB_REPO_URL;
  // A config-supplied URL becomes an href here, so refuse the schemes that
  // would execute in the host page (same guard as the deep link).
  if (!href || /^\s*(javascript|data|vbscript):/i.test(href)) return null;

  const title = t('go.poweredby');
  const cta = t('go.poweredby.cta');

  return (
    <Tooltip
      content={
        <div className={s.tip}>
          <div className={s['tip-title']}>{title}</div>
          {/* Non-breaking space: the arrow belongs to the last word, not to a
              line of its own. */}
          <div className={s['tip-cta']}>{`${cta} ↗`}</div>
        </div>
      }
      position="topLeft"
      spacing={8}
      getPopupContainer={getPopupContainer}
    >
      {/* The slot holds the mark's place and takes the pointer while the mark
          itself is inert, so entering the widget *directly onto* the corner
          reveals it (and swallows that first click) instead of hitting a link
          that isn't there yet. */}
      <span className={s.slot}>
        <a
          className={s.mark}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${title} — ${cta}`}
        >
          <span aria-hidden="true">&lt;Go/&gt;</span>
        </a>
      </span>
    </Tooltip>
  );
}
