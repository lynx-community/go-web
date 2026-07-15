---
'@lynx-js/go-web': minor
---

Add "Open in ..." panel for launching the current entry in a native host app (Lynx Explorer / Lynxtron Go / Sparkling / …).

**New props on `<Go>` / `EmbedOptions`**:

- `deepLinkUrl?: string` — deep-link URL template. Supports `{{{url}}}` (raw entry URL) and `{{{urlEncoded}}}` (encoded). Overrides the framework's default scheme when set.
- `nativeFramework?: string` — native framework the bundle requires at runtime (e.g. `"lynxtron"`, `"sparkling"`). Unset = universal (runs anywhere, opens in Lynx Explorer). Each known framework has a platform (desktop / mobile) and a default deep-link scheme. Also read from `example-metadata.json`'s new top-level `nativeFramework` field; the prop overrides.

**New metadata field**:

- `example-metadata.json` gains an optional top-level `nativeFramework?: string`. Absent = universal; present = the framework's platform drives the "open" surface (see below).

**UI**: the QR code and deep link are independent, chosen from the framework's platform × the viewer's platform:

- **universal** — QR + deep link on both desktop and mobile.
- **desktop framework** (e.g. `lynxtron`) — deep link on desktop; on mobile, a "desktop only" hint (optionally linking to docs) since it can't run on a phone.
- **mobile framework** (e.g. `sparkling`) — QR on desktop (scan to open on a phone); deep link + QR on mobile.

The deep link is a single bordered link everywhere it appears. The button label i18n key is `go.deeplink.open.{nativeFramework | 'default'}`; default keys shipped for `default`, `lynxtron`, `sparkling`.
