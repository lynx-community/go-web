---
'@lynx-js/go-web': minor
---

Decouple `<Go>` chrome copy from host/Rspress i18n.

- `go.*` strings are package-owned (`en` / `zh` via `useLang`); override with `config.i18n` only.
- `rspressAdapter` no longer wires Rspress `useI18n` — site `i18n.json` does not need `go.*` keys.
- Removed `GoConfig.useI18n` (breaking for custom hooks; use `i18n` + `useLang` instead).
