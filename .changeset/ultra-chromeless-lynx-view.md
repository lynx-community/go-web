---
'@lynx-js/go-web': minor
---

Add `mode="ultra"` — an absolutely chromeless full-viewport `<lynx-view>` experience.

From the default widget, clicking the fullscreen control again while already fullscreen with code hidden (and a web preview available) enters the same ultra chromeless mode (CSS overlay + best-effort Browser Fullscreen API) without remounting `<lynx-view>`. Esc / exit browser fullscreen restores Go chrome.
