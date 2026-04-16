---
'@lynx-js/go-web': minor
---

Remove the `@lynx-js/web-elements` peer dependency and require `@lynx-js/web-core >= 0.20.0`.

If your app pinned `@lynx-js/web-core < 0.20.0`, upgrade it to satisfy the new peer requirement. If you only installed `@lynx-js/web-elements` for `@lynx-js/go-web`, you can remove it.
