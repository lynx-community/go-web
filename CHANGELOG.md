# @lynx-js/go-web

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
