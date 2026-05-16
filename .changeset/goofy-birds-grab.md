---
'@lynx-js/go-web': patch
---

Fix intermittent `<lynx-view>` first-load race by passing `url` via JSX attribute (instead of effect-time property assignment). Remove unreliable shadowRoot-based "rendered" detection (no reliable ready event; shadow content can exist even when bundle never loads), set `browserConfig` synchronously in ref for fit mode, and surface Lynx `error` events in the overlay.
