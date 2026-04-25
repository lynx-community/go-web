---
'@lynx-js/go-web': minor
---

Add `webPreviewMode` to `ExamplePreview` / `Go` to control how the web preview renders `<lynx-view>`:

- `responsive`: current behavior, `<lynx-view>` fills the container
- `fit`: fixed design canvas (`designWidth`/`designHeight`) scaled into the container via CSS transform
- `auto`: switches between `fit` and `responsive` based on container size (`fitThresholdScale` / `fitMinScale`)

Also adds optional `designWidth`, `designHeight`, `fitThresholdScale`, and `fitMinScale` props (and embed options) to configure the viewport behavior.
