---
'@lynx-js/go-web': patch
---

Fix the deep-link probe on Windows: the browser's protocol-confirmation dialog blurs the tab whether or not an app is registered for the scheme, so treating `blur` as a hand-off signal made the probe silently commit "installed" — the `downloadUrl` fallback would never appear, even when the app wasn't installed. The probe now relies on `visibilitychange -> hidden` (fires only when another window actually covers the tab) plus the 5s timeout. Follow-up to #74.
