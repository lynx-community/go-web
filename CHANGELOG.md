# @lynx-js/go-web

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
