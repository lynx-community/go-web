---
'@lynx-js/go-web': minor
---

Add "Open in ..." panel for launching the current entry in a native host app (Lynx Explorer / Lynxtron Go / Sparkling / …).

**New props on `<Go>` / `EmbedOptions`**:

- `deepLinkUrl?: string` — URL template. Supports `{{{url}}}` (raw entry URL) and `{{{urlEncoded}}}` (encoded).
- `nativeFramework?: string` — native framework required by the bundle at runtime (e.g. `"lynxtron"`, `"sparkling"`). When unset, the bundle has no native framework dependency and is treated as universal (opens in Lynx Explorer by default). Also read from `example-metadata.json`'s new top-level `nativeFramework` field; the prop overrides.

**New metadata field**:

- `example-metadata.json` gains an optional top-level `nativeFramework?: string`. Absent = universal. Present (e.g. `"lynxtron"`) = QR tab is hidden and only the corresponding deep-link entry is offered.

**UI**: three responsive variants driven by `(nativeFramework, isMobile)`: `tab` (universal + desktop, deep link inside QR tab), `bottom-sheet` (mobile), `floating-toast` (native-framework + desktop). The button label i18n key is `go.deeplink.open.{nativeFramework | 'default'}`; new default keys shipped for `default`, `lynxtron`, `sparkling`.
