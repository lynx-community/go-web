---
'@lynx-js/go-web': minor
---

Add `GoConfig.nativeFrameworks`, per-framework overrides for the built-in native framework registry, so a site can supply the URLs this package can't own: `downloadUrl` (where to get the host app) and `learnMoreUrl` (where to send a viewer whose device can't run the bundle), plus `appName` / `deepLinkScheme`. Both URLs accept a plain string or a `{ cn, en }` pair, mirroring `explorerUrl`. `platform` is deliberately not overridable.

A deep link to an app that isn't installed fails silently, so when `downloadUrl` is set the deep link now carries a quieter download link beneath it (`go.deeplink.download.*`, suffixable per framework like the `open` keys). The can't-run-here hint links to `learnMoreUrl` when one is supplied, and stays plain text otherwise.
