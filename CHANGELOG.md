# @lynx-js/go-web

## 0.6.0

### Minor Changes

- Add "Open in ..." panel for launching the current entry in a native host app (Lynx Explorer / Lynxtron Go / Sparkling / …). ([#61](https://github.com/lynx-community/go-web/pull/61))

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

## 0.5.1

### Patch Changes

- Fix intermittent `<lynx-view>` first-load race by passing `url` via JSX attribute (instead of effect-time property assignment). Remove unreliable shadowRoot-based "rendered" detection (no reliable ready event; shadow content can exist even when bundle never loads), set `browserConfig` synchronously in ref for fit mode, and surface Lynx `error` events in the overlay. ([#57](https://github.com/lynx-community/go-web/pull/57))

## 0.5.0

### Minor Changes

- Improve web preview fit behavior and default `webPreviewMode` to `responsive`. ([#54](https://github.com/lynx-community/go-web/pull/54))

## 0.4.0

### Minor Changes

- Add `webPreview` prop to disable the Web preview tab. ([#50](https://github.com/lynx-community/go-web/pull/50))

## 0.3.1

### Patch Changes

- Lower default `fitThresholdScale` from `1.5` to `1.0` and document viewport mode props in README. ([#48](https://github.com/lynx-community/go-web/pull/48))

- Improve WebIframe CSR rendering performance. ([#48](https://github.com/lynx-community/go-web/pull/48))

## 0.3.0

### Minor Changes

- Add `webPreviewMode` to `ExamplePreview` / `Go` to control how the web preview renders `<lynx-view>`: ([#45](https://github.com/lynx-community/go-web/pull/45))
  - `responsive`: current behavior, `<lynx-view>` fills the container
  - `fit`: fixed design canvas (`designWidth`/`designHeight`) scaled into the container via CSS transform
  - `auto`: switches between `fit` and `responsive` based on container size (`fitThresholdScale` / `fitMinScale`)

  Also adds optional `designWidth`, `designHeight`, `fitThresholdScale`, and `fitMinScale` props (and embed options) to configure the viewport behavior.

## 0.2.2

### Patch Changes

- Fix white flash when switching to Web preview tab by keeping `<lynx-view>` mounted and eagerly preloading content. ([#40](https://github.com/lynx-community/go-web/pull/40))

## 0.2.1

### Patch Changes

- Fix `<lynx-view>` unit scaling so `rpx`/`vh`/`vw` match mobile behavior in embedded contexts. ([#38](https://github.com/lynx-community/go-web/pull/38))

## 0.2.0

### Minor Changes

- Remove the `@lynx-js/web-elements` peer dependency and require `@lynx-js/web-core >= 0.20.0`. ([#36](https://github.com/lynx-community/go-web/pull/36))

  If your app pinned `@lynx-js/web-core < 0.20.0`, upgrade it to satisfy the new peer requirement. If you only installed `@lynx-js/web-elements` for `@lynx-js/go-web`, you can remove it.

## 0.1.1

### Patch Changes

- Include CHANGELOG.md in the published package and improve package metadata. ([#34](https://github.com/lynx-community/go-web/pull/34))

## 0.1.0

### Minor Changes

- Initial release. ([#27](https://github.com/lynx-community/go-web/pull/27))
