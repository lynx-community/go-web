---
'@lynx-js/go-web': minor
---

Add `GoConfig.nativeFrameworks`, per-framework overrides for the built-in native framework registry, so a site can supply the URLs this package can't own: `downloadUrl` (where to get the host app) and `learnMoreUrl` (where to send a viewer whose device can't run the bundle), plus `appName` / `deepLinkScheme`. Both URLs accept a plain string or a `{ cn, en }` pair, mirroring `explorerUrl`. `platform` is deliberately not overridable.

A deep link to an app that isn't installed fails silently. Rather than showing a download prompt next to every deep link — which reads as "this probably won't work" — the click itself is the probe: if the tab is still visible and focused ~5s after the navigation, nothing handled the scheme, and the link is replaced **in place** by `downloadUrl` (`go.deeplink.download.*`, suffixable per framework like the `open` keys). The inference is one-way — only ever "not installed", never "installed" — and a callback arriving more than 8s late is discarded, since that means the tab was suspended rather than that the app is missing. Probing is skipped entirely when no `downloadUrl` is configured. This revives the fallback mechanism designed in #60, which was superseded before it landed.

The can't-run-here hint (a desktop bundle opened on a phone) links to `learnMoreUrl` when one is supplied, and stays plain text otherwise — no probing there, since nothing can launch on that device anyway.
