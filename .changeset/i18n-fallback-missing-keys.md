---
'@lynx-js/go-web': patch
---

Fall back to built-in English `go.*` strings when a host `useI18n` (e.g. Rspress) throws or returns a non-string for a missing key, so upgrading `<Go>` without updating site `i18n.json` no longer crashes the host app.
