---
'@lynx-js/go-web': minor
---

Add opt-in preview extension points for native modules and multi-page (MPA) examples.

- **Level A** — `GoConfig.previewNativeEnv` and the per-instance `nativeEnv` prop forward a generic native environment (`onNativeModulesCall`, `nativeModulesMap`, `napiModulesMap`, `onNapiModulesCall`, and a static-or-factory `globalProps` / `initData`) to the previewed `<lynx-view>` before it starts.
- **Level B** — `GoConfig.PreviewRuntime` replaces the built-in single-card renderer with a custom component (receiving every previewable entry plus the resolved native environment) so embedders can stack cards and route cross-page navigation, while go-web keeps owning the tab bar, QR, code browser, scaling, and SSG path.

Both are backwards compatible and product-agnostic: when unset, the preview is identical to before, and go-web hard-codes no framework module names or URL scheme.
