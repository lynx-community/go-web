---
'@lynx-js/go-web': minor
---

Add a hover-revealed `<Go/>` mark to the footer, linking to this repo.

Until now nothing in an embed said what the surrounding widget _is_: the footer's
GitHub button goes to the example's source, so a reader who wanted the same
code-plus-live-preview pane on their own site had nowhere to click. The mark sits
in the footer's bottom-left corner, invisible at rest, faint while the pointer is
inside the widget, and a full link on its own hover — so it costs the resting
composition nothing. Set `GoConfig.poweredBy` to `false` to remove it, or to a
URL to point it elsewhere.
