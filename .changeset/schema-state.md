---
'@lynx-js/go-web': patch
---

Preserve host selection and edited schemas across host and entry changes,
including temporary empty options. Apply current defaults to unedited
hosts and clear edits when a host is removed from nonempty options.

Derive QR and copied links together without render-phase parent updates.
Keep incomplete URL edits as drafts and use the last valid schema for
QR and copy.
