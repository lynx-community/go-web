---
'@lynx-js/go-web': minor
---

Add `webLoadingScreen` (`'overlay' | 'preview'`) so the Web tab can use the Preview image/video as its loading screen while the web bundle loads concurrently, then reveal the live Web view once it paints. When omitted, auto-selects `'preview'` if `defaultTab` is `'web'` and a preview image exists; otherwise `'overlay'`.
