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
 * The one place the widget names itself: a `<Go/>` mark sitting just ahead of
 * the footer's `example › file` breadcrumb — the namespace of the thing being
 * named — printed in the same ink as the lettering around it and lighting up
 * in link blue on hover.
 *
 * Not in the corner: that belongs to the file-tree button, and a brand mark
 * that displaces an existing control to take the corner buys attention with
 * someone else's muscle memory.
 *
 * The footer's GitHub button already links out — but to *this example's*
 * source, which is what a reader wants and not at all what someone who wants
 * the surrounding widget is looking for. That reader currently has nowhere to
 * click: the code pane, the live preview and the QR tab are all evidently
 * *something*, and nothing on screen says what.
 *
 * It stays legible at rest rather than appearing only on hover: a corner that
 * holds a mark's worth of space and shows nothing reads as a layout mistake,
 * and nobody hovers a gap on the off-chance. Quiet grey costs the composition
 * almost nothing and still says "this is a thing, and it has a name".
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
      <a
        className={s.mark}
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`${title} — ${cta}`}
      >
        <span aria-hidden="true">&lt;Go/&gt;</span>
      </a>
    </Tooltip>
  );
}
