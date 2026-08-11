---
'@lynx-js/go-web': minor
---

Support complete Web application entries through
`templateFiles[].webHostFile`. Web host entries render in an iframe and take
precedence over raw `.web.bundle` previews, so examples can own their Web
runtime, bridge, and `<lynx-view>`.
