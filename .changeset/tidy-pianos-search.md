---
'@lynx-js/go-web': minor
---

Add a `<Go/>` mark to the footer, linking to this repo.

Until now nothing in an embed said what the surrounding widget _is_: the footer's
GitHub button goes to the example's source, so a reader who wanted the same
code-plus-live-preview pane on their own site had nowhere to click. The mark sits
in the footer's bottom-left corner as faint grey chrome, brightens while the
pointer is inside the widget, and turns into a link on its own hover. Set
`GoConfig.poweredBy` to `false` to remove it, or to a URL to point it elsewhere.
